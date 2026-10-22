// Cases ported from NextLevelOS src/themes/big-box-list/BigBoxListTheme.test.tsx @ 3d530b7 on a
// FakeThemeHost, plus the S5 tabs, favorite and page jumps (D5) the rebuild adds.
import type { MenuTree } from '@nextlevel/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FakeThemeHost } from '../host/FakeThemeHost.ts';
import { FIXTURE_MENU } from '../host/fixtures.ts';
import { NO_ART_FILES, press, renderTheme, shows } from '../themeTestUtils.tsx';
import { bigBoxListTheme } from './index.ts';

vi.mock('../components/useNavigationSound.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../components/useNavigationSound.ts')>()),
  useNavigationSound: vi.fn(),
}));

/** The fixture menu with a short name on Nintendo 64. */
const MENU: MenuTree = JSON.parse(
  JSON.stringify(FIXTURE_MENU).replace(
    '"name":"Nintendo 64"',
    '"name":"Nintendo 64","shortName":"n64"',
  ),
) as MenuTree;

const card = () => document.querySelector('.bigbox-card')?.textContent ?? '';
const focusedRow = () => document.querySelector('.bbl-row--focused')?.textContent ?? null;
const count = () => document.querySelector('.bbl-count')?.textContent ?? null;

function mount(host = new FakeThemeHost({ menu: MENU, art: NO_ART_FILES })) {
  return renderTheme(bigBoxListTheme, { host });
}

async function openN64(host?: FakeThemeHost) {
  const ctx = mount(host);
  await shows('Nintendo');
  press('Enter');
  await waitFor(() => {
    expect(card()).toContain('Super Nintendo');
  });
  press('ArrowRight');
  press('Enter');
  await waitFor(() => {
    expect(focusedRow()).toBe('N64 A');
  });
  return ctx;
}

describe('Big Box List (FR-THM-1)', () => {
  it('does not grab focus on window focus while input is disabled', async () => {
    renderTheme(bigBoxListTheme, { inputEnabled: false });
    await shows('Nintendo');
    const outside = document.createElement('textarea');
    document.body.append(outside);
    outside.focus();
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('menu levels are Big Box’s menu: left/right move, down does nothing', async () => {
    mount();
    await shows('Nintendo');
    press('ArrowRight');
    expect(card()).toContain('Sega');
    press('ArrowDown');
    expect(card()).toContain('Sega');
    press('ArrowLeft');
    expect(card()).toContain('Nintendo');
  });

  it('a system opens the split list: title, count, badge; up/down move and wrap', async () => {
    await openN64();
    expect(screen.getByRole('heading', { name: 'Nintendo 64' })).toBeInTheDocument();
    expect(count()).toBe('8 games');
    expect(screen.getByText('N64')).toBeInTheDocument();
    expect(document.querySelector('.bbl-logo-text')?.textContent).toBe('N64 A');
    press('ArrowDown');
    expect(focusedRow()).toBe('N64 B');
    press('ArrowRight'); // not bound on the games level
    expect(focusedRow()).toBe('N64 B');
    press('ArrowUp');
    press('ArrowUp');
    expect(focusedRow()).toBe('N64 H');
  });

  it('select plays the focused game', async () => {
    const { host } = await openN64();
    press('ArrowDown');
    press('Enter');
    expect(host.calls.find((call) => call.method === 'launch')?.args).toEqual([12]);
  });

  it('a filter leaf: the system title, the filter next to the count', async () => {
    mount();
    await shows('Nintendo');
    press('Enter');
    await waitFor(() => {
      expect(card()).toContain('Super Nintendo');
    });
    press('Enter'); // Super Nintendo → its filter menu
    await waitFor(() => {
      expect(card()).toContain('Official');
    });
    press('Enter'); // Official
    await waitFor(() => {
      expect(focusedRow()).toBe('Snes A');
    });
    expect(screen.getByRole('heading', { name: 'Super Nintendo' })).toBeInTheDocument();
    expect(count()).toBe('8 games · Official');
    expect(document.querySelector('.bbl-badge')).toBeNull();
  });

  it('back returns to the menu and restores left/right', async () => {
    await openN64();
    press('Escape');
    await waitFor(() => {
      expect(card()).toContain('Nintendo 64');
    });
    press('ArrowLeft');
    expect(card()).toContain('Super Nintendo');
  });

  it('search narrows the list and the count; no match shows No games', async () => {
    await openN64();
    press('KeyF');
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'N64 C' } });
    await waitFor(() => {
      expect(count()).toBe('1 game');
    });
    expect(focusedRow()).toBe('N64 C');
    fireEvent.change(input, { target: { value: 'zzz' } });
    await waitFor(() => {
      expect(screen.getByText('No games')).toBeInTheDocument();
    });
    expect(count()).toBe('0 games');
  });

  it('the search icon opens and closes search and keys keep working', async () => {
    await openN64();
    const button = screen.getByRole('button', { name: 'Search titles' });
    fireEvent.click(button);
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.queryByRole('searchbox')).toBeNull();
    press('ArrowDown');
    expect(focusedRow()).toBe('N64 B');
  });

  it('screen spec S5: favorite shows the game in the Favorites tab (LB/RB)', async () => {
    await openN64();
    press('ArrowDown');
    press('KeyX');
    press('KeyE');
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Favorites/ })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
    await waitFor(() => {
      expect(focusedRow()).toBe('N64 B');
    });
    expect(count()).toBe('1 game');
  });

  it('D5: PageDown jumps a page and stops at the last game', async () => {
    await openN64();
    press('PageDown');
    expect(focusedRow()).toBe('N64 H');
    press('PageUp');
    expect(focusedRow()).toBe('N64 A');
  });
});
