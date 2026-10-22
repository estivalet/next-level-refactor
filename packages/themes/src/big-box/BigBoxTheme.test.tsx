// Cases ported from NextLevelOS src/themes/big-box/BigBoxTheme.test.tsx @ 3d530b7 on a
// FakeThemeHost, plus keyboard/gamepad-action flows (US-C1) and the S5 game-list tabs.
import type { MenuTree } from '@nextlevel/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useNavigationSound } from '../components/useNavigationSound.ts';
import { FakeThemeHost } from '../host/FakeThemeHost.ts';
import { press, renderTheme, shows } from '../themeTestUtils.tsx';
import { bigBoxTheme } from './index.ts';

vi.mock('../components/useNavigationSound.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../components/useNavigationSound.ts')>()),
  useNavigationSound: vi.fn(),
}));

const card = () => document.querySelector('.bigbox-card') as HTMLElement;

/** Root → Nintendo → Nintendo 64 with the keyboard. */
async function openN64() {
  const ctx = renderTheme(bigBoxTheme);
  await shows('Nintendo');
  press('Enter');
  await waitFor(() => {
    expect(card()).toHaveTextContent('Super Nintendo');
  });
  press('ArrowRight');
  press('Enter');
  await waitFor(() => {
    expect(card()).toHaveTextContent('N64 A');
  });
  return ctx;
}

describe('Big Box (FR-THM-1)', () => {
  it('renders the root menu with the focused item in the card and an Open button', async () => {
    renderTheme(bigBoxTheme);
    await shows('Nintendo');
    expect(card()).toHaveTextContent('Nintendo');
    expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument();
  });

  it('does not grab focus on window focus while input is disabled', async () => {
    renderTheme(bigBoxTheme, { inputEnabled: false });
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

  it('wires navigation sound: menu level, carousel focus, not muted', async () => {
    vi.mocked(useNavigationSound).mockClear();
    renderTheme(bigBoxTheme);
    await shows('Nintendo');
    const last = vi.mocked(useNavigationSound).mock.calls.at(-1)?.[0];
    expect(last).toMatchObject({ focusKey: 0, levelKind: 'menu', muted: false });
    expect(last?.levelKey).toContain('m:root');
  });

  it('shows an error with Retry when the menu cannot load', async () => {
    class FailingHost extends FakeThemeHost {
      override getMenu(): Promise<MenuTree> {
        return Promise.reject(new Error('boom'));
      }
    }
    renderTheme(bigBoxTheme, { host: new FailingHost() });
    await shows('Couldn’t load the menu');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('Big Box navigation (FR-THM-3, US-C1)', () => {
  it('right moves along the carousel, select enters, back leaves', async () => {
    renderTheme(bigBoxTheme);
    await shows('Nintendo');
    press('ArrowRight');
    await waitFor(() => {
      expect(card()).toHaveTextContent('Sega');
    });
    press('Enter');
    await waitFor(() => {
      expect(card()).toHaveTextContent('Sega Genesis');
    });
    press('Escape');
    await waitFor(() => {
      expect(card()).toHaveTextContent('Sega');
    });
  });

  it('back at the root and the menu action both open the theme menu', async () => {
    const { onExit } = renderTheme(bigBoxTheme);
    await shows('Nintendo');
    press('Escape');
    press('Tab');
    expect(onExit).toHaveBeenCalledTimes(2);
  });

  it('a system with filters opens its filter menu (filters in the menu)', async () => {
    renderTheme(bigBoxTheme);
    await shows('Nintendo');
    press('Enter');
    await waitFor(() => {
      expect(card()).toHaveTextContent('Super Nintendo');
    });
    press('Enter');
    await waitFor(() => {
      expect(card()).toHaveTextContent('Official');
    });
  });

  it('a games level shows the game, its tabs and plays it with select', async () => {
    const { host } = await openN64();
    expect(screen.getByRole('tab', { name: /All/ })).toHaveAttribute('aria-selected', 'true');
    press('ArrowRight');
    await waitFor(() => {
      expect(card()).toHaveTextContent('N64 B');
    });
    press('Enter');
    const launch = host.calls.find((call) => call.method === 'launch');
    expect(launch?.args).toEqual([12]);
  });

  it('favorite toggles the focused game and the Favorites tab shows it', async () => {
    const { host } = await openN64();
    press('KeyX');
    expect(host.calls.find((call) => call.method === 'setGameFlags')?.args).toEqual([
      11,
      { favorite: true },
    ]);
    press('KeyE');
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Favorites/ })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
    expect(card()).toHaveTextContent('N64 A');
  });

  it('search filters the carousel; back closes the search', async () => {
    await openN64();
    press('KeyF');
    const search = await screen.findByRole('searchbox', { name: 'Search titles' });
    fireEvent.change(search, { target: { value: 'N64 C' } });
    await waitFor(() => {
      expect(card()).toHaveTextContent('N64 C');
    });
    fireEvent.keyDown(search, { key: 'Escape', code: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('searchbox')).toBeNull();
    });
  });

  it('help lists the user’s keys and closes on back', async () => {
    renderTheme(bigBoxTheme);
    await shows('Nintendo');
    press('F1');
    const dialog = await screen.findByRole('dialog', { name: 'Controls' });
    expect(dialog).toHaveTextContent('Toggle favorite');
    press('Escape', dialog);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('mouse: a double-click on a menu plate enters it', async () => {
    renderTheme(bigBoxTheme);
    await shows('Sega');
    const plate = screen.getAllByText('Sega').at(-1) as HTMLElement;
    fireEvent.doubleClick(plate);
    await waitFor(() => {
      expect(card()).toHaveTextContent('Sega Genesis');
    });
  });
});

describe('Big Box keymap (US-C1)', () => {
  it('every Big Box intent is reachable from a default gamepad button', () => {
    const pad = new FakeThemeHost().input().gamepad;
    // Home has no default button (Guide stays unbound); back walks up to the root instead, and
    // Settings → Input can bind one.
    const intents = new Set(Object.values(bigBoxTheme.keymap).filter((i) => i !== 'home'));
    expect(pad.back.length).toBeGreaterThan(0);
    for (const intent of intents) {
      const actions = Object.entries(bigBoxTheme.keymap)
        .filter(([, mapped]) => mapped === intent)
        .map(([action]) => action as keyof typeof pad);
      expect(
        actions.some((action) => pad[action].length > 0),
        intent,
      ).toBe(true);
    }
  });

  it('binds the always-available actions of screen spec S5', () => {
    expect(new Set(Object.values(bigBoxTheme.keymap))).toEqual(
      new Set([
        'focus-prev',
        'focus-next',
        'enter',
        'back',
        'home',
        'open-menu',
        'show-help',
        'toggle-search',
        'toggle-favorite',
        'toggle-hidden',
        'tab-prev',
        'tab-next',
      ]),
    );
  });
});
