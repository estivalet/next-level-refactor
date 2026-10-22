// Cases ported from NextLevelOS src/themes/console-home/ConsoleHomeTheme.test.tsx @ 3d530b7 on a
// FakeThemeHost (Nintendo → Nintendo 64 has N64 A..H; here N64 C is hidden), driven by actions.
import type { ThemeGame } from '@nextlevel/shared';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useNavigationSound } from '../components/useNavigationSound.ts';
import { FakeThemeHost } from '../host/FakeThemeHost.ts';
import { FIXTURE_GAMES } from '../host/fixtures.ts';
import { NO_ART_FILES, press, renderTheme, shows } from '../themeTestUtils.tsx';
import { consoleHomeTheme } from './index.ts';

vi.mock('../components/useNavigationSound.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../components/useNavigationSound.ts')>()),
  useNavigationSound: vi.fn(),
}));

const lastSound = () => vi.mocked(useNavigationSound).mock.calls.at(-1)?.[0];

const GAMES: ThemeGame[] = FIXTURE_GAMES.map((g) =>
  g.title === 'N64 C' ? { ...g, hidden: true } : g,
);

const root = () => document.querySelector('.ch-root') as HTMLElement;
const focusedCell = () => {
  const cell = document.querySelector('.ch-cell--focused');
  return cell?.querySelector('img')?.alt ?? cell?.textContent ?? null;
};
const tab = (name: RegExp) => screen.getByRole('tab', { name });

async function openN64(host = new FakeThemeHost({ games: GAMES, art: NO_ART_FILES })) {
  const ctx = renderTheme(consoleHomeTheme, { host });
  await shows('Nintendo');
  press('Enter');
  await waitFor(() => {
    expect(document.querySelector('.ch-focus-title')?.textContent).toBe('Super Nintendo');
  });
  press('ArrowRight');
  press('Enter');
  await screen.findByRole('tab', { name: /All/ });
  return ctx;
}

describe('Console Home (FR-THM-1)', () => {
  it('shows menu tiles and drills into a tabbed games grid without hidden games', async () => {
    await openN64();
    expect(tab(/All/)).toHaveTextContent('7');
    expect(tab(/Hidden/)).toHaveTextContent('1');
    expect(focusedCell()).toBe('N64 A');
    expect(screen.queryByText('N64 C')).toBeNull();
  });

  it('LB/RB (Q/E) cycle the tabs to Hidden', async () => {
    await openN64();
    press('KeyE');
    press('KeyE');
    expect(tab(/Hidden/)).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByText('N64 C').length).toBeGreaterThan(0);
  });

  it('a full row down: the grid has six columns', async () => {
    await openN64();
    press('ArrowDown');
    expect(focusedCell()).toBe('N64 H');
  });

  it('D5: PageDown jumps a page and stops at the last game', async () => {
    await openN64();
    press('PageDown');
    expect(focusedCell()).toBe('N64 H');
    press('PageUp');
    expect(focusedCell()).toBe('N64 A');
  });

  it('select plays the focused game', async () => {
    const { host } = await openN64();
    press('ArrowRight');
    press('Enter');
    expect(host.calls.find((call) => call.method === 'launch')?.args).toEqual([12]);
  });

  it('favorite toggles the focused game', async () => {
    await openN64();
    press('ArrowRight');
    press('KeyX');
    await waitFor(() => {
      expect(tab(/Favorites/)).toHaveTextContent('1');
    });
  });

  it('help opens the key help and back closes it', async () => {
    await openN64();
    press('F1');
    const dialog = screen.getByRole('dialog', { name: 'Controls' });
    expect(within(dialog).getByText('Toggle favorite')).toBeInTheDocument();
    press('Escape');
    expect(screen.queryByRole('dialog', { name: 'Controls' })).toBeNull();
  });

  it('keys on an empty tab do nothing and do not crash', async () => {
    await openN64();
    press('KeyE'); // Favorites, empty
    expect(screen.getByText('No games in this tab')).toBeInTheDocument();
    for (const code of ['ArrowRight', 'ArrowDown', 'Enter', 'KeyX', 'KeyH']) press(code);
    expect(screen.getByText('No games in this tab')).toBeInTheDocument();
  });

  it('the rail Back button leaves the keyboard on the theme root', async () => {
    await openN64();
    const back = root().querySelector<HTMLElement>('.ch-rail button[aria-label="Back"]');
    expect(fireEvent.mouseDown(back as HTMLElement)).toBe(false);
    back?.focus();
    act(() => {
      fireEvent.click(back as HTMLElement);
    });
    await waitFor(() => {
      expect(screen.queryByRole('tab', { name: /All/ })).toBeNull();
    });
    expect(document.activeElement).toBe(root());
  });

  it('footer and rail buttons do not take focus on press', async () => {
    await openN64();
    for (const selector of [
      '.ch-footer button[aria-label="Back"]',
      '.ch-footer button[aria-label="Exit"]',
      '.ch-rail button[aria-label="Search titles"]',
    ]) {
      expect(fireEvent.mouseDown(root().querySelector(selector) as HTMLElement)).toBe(false);
    }
  });

  it('the footer Exit button opens the theme menu', async () => {
    const { onExit } = await openN64();
    fireEvent.click(root().querySelector('.ch-footer button[aria-label="Exit"]') as HTMLElement);
    expect(onExit).toHaveBeenCalled();
  });

  it('search: Enter hands input to the filtered grid; back there closes search', async () => {
    await openN64();
    press('KeyF');
    const input = screen.getByRole('searchbox');
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: 'N64 B' } });
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(screen.getByRole('searchbox')).toHaveValue('N64 B');
    expect(document.activeElement).toBe(root());
    press('KeyX');
    await waitFor(() => {
      expect(tab(/Favorites/)).toHaveTextContent('1');
    });
    press('Escape');
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(tab(/All/)).toBeInTheDocument();
  });

  it('the status bar shows the menu title at the root', async () => {
    renderTheme(consoleHomeTheme);
    await shows('Nintendo');
    expect(root().querySelector('.ch-breadcrumb')).toHaveTextContent('NextLevel');
  });

  it('navigation sound: moves within a level, silent level changes, tabs and help', async () => {
    vi.mocked(useNavigationSound).mockClear();
    await openN64();
    expect(lastSound()?.levelKind).toBe('games');
    const gamesLevel = lastSound()?.levelKey;
    const focus = lastSound()?.focusKey;
    press('ArrowRight');
    await waitFor(() => {
      expect(lastSound()?.focusKey).not.toBe(focus);
    });
    expect(lastSound()?.levelKey).toBe(gamesLevel);
    press('KeyE');
    await waitFor(() => {
      expect(lastSound()?.levelKey).not.toBe(gamesLevel);
    });
    press('F1');
    await waitFor(() => {
      expect(lastSound()?.muted).toBe(true);
    });
  });
});
