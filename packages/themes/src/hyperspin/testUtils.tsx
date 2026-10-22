// Test-only helpers for the HyperSpin theme tests: a menu with a plain system at the root and a
// letter-run game list, mounted on a FakeThemeHost.
import type { ArtIndex, MenuNode, MenuTree, ThemeGame, ThemeOptions } from '@nextlevel/shared';
import { waitFor } from '@testing-library/react';
import { expect } from 'vitest';
import { FakeThemeHost } from '../host/FakeThemeHost.ts';
import { FIXTURE_GAMES, FIXTURE_MENU } from '../host/fixtures.ts';
import { NO_ART_FILES, press, renderTheme } from '../themeTestUtils.tsx';
import { hyperspinTheme } from './index.ts';

const solo: MenuNode = {
  id: 's:solo',
  name: 'Solo',
  display: 'Solo',
  type: 'system',
  systemId: 'solo',
  children: [],
};

/** The fixture menu (Nintendo · Sega · Collections) plus the system Solo at the root. */
export const HS_MENU: MenuTree = { ...FIXTURE_MENU, items: [...FIXTURE_MENU.items, solo] };

const game = (id: number, title: string, extra: Partial<ThemeGame> = {}): ThemeGame => ({
  id,
  systemId: 'solo',
  title,
  year: null,
  genre: null,
  players: null,
  developer: null,
  publisher: null,
  favorite: false,
  hidden: false,
  filters: [],
  playCount: 0,
  lastPlayedAt: null,
  media: [],
  ...extra,
});

/** Solo's games in display order. Runs: # | A A | B B; Gamma is hidden, Beta a favorite. */
export const SOLO_GAMES: ThemeGame[] = [
  game(901, '1942'),
  game(902, 'Alpha'),
  game(903, 'Avenger'),
  game(904, 'Beta', { favorite: true }),
  game(905, 'Bravo'),
  game(906, 'Gamma', { hidden: true }),
];

export const focusedLabel = () =>
  document.querySelector('[data-wheel] [data-focused="true"]')?.textContent ?? null;
export const filterLabel = () =>
  document.querySelector('[aria-label="Filter"] .hs-filter-name')?.textContent ?? null;
export const filterPos = () =>
  document.querySelector('[aria-label="Filter"] .hs-filter-pos')?.textContent ?? null;
export const pointerFor = (name: string) =>
  document.querySelector<HTMLElement>(`[data-pointer="${name}"]`);
export const focusedSlotHeight = () =>
  document.querySelector<HTMLElement>('[data-wheel] [data-focused="true"]')?.style.height;

export function mountHyperspin(
  opts: { settings?: Record<string, unknown>; art?: ArtIndex; menu?: MenuTree } = {},
) {
  const options: Record<string, ThemeOptions> = opts.settings
    ? { hyperspin: { settings: opts.settings } }
    : {};
  const host = new FakeThemeHost({
    menu: opts.menu ?? HS_MENU,
    games: [...FIXTURE_GAMES, ...SOLO_GAMES],
    art: opts.art ?? NO_ART_FILES,
    options,
  });
  return renderTheme(hyperspinTheme, { host });
}

export async function atRoot() {
  await waitFor(() => {
    expect(focusedLabel()).toBe('Nintendo');
  });
}

/** Root → Solo's games (up from Nintendo wraps to Solo). */
export async function openSolo() {
  await atRoot();
  press('ArrowUp');
  expect(focusedLabel()).toBe('Solo');
  press('Enter');
  await waitFor(() => {
    expect(focusedLabel()).toBe('1942');
  });
}
