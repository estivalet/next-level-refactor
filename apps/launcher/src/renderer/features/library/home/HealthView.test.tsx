import {
  HEALTH_FIELDS,
  HEALTH_GAPS,
  ok,
  type GameListQuery,
  type MenuTree,
  type SystemHealth,
} from '@nextlevel/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../../test-utils.tsx';
import { LibraryApp } from '../LibraryApp.tsx';
import { gameRow, libraryResponses } from '../testing.ts';

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
});
afterEach(() => {
  setBridgeForTests(null);
  vi.restoreAllMocks();
});

function health(systemId: string, games: number, lacking: Partial<SystemHealth['lacking']> = {}) {
  const none = Object.fromEntries(HEALTH_GAPS.map((gap) => [gap, 0])) as SystemHealth['lacking'];
  return { systemId, games, lacking: { ...none, ...lacking } };
}

const allDetails = (count: number) =>
  Object.fromEntries(HEALTH_FIELDS.map((field) => [`field:${field}`, count]));

// N64 is perfect (A); Genesis lacks every ROM and half its box art (C, 61); SNES is F.
// The test catalog names N64 and SNES; Genesis shows its id.
const HEALTH = [
  health('nintendo-64', 2),
  health('sega-genesis', 4, { rom: 4, 'art:box-front': 2, 'art:video': 4 }),
  health('snes', 2, {
    rom: 2,
    'art:box-front': 2,
    'art:screenshot-game-play': 2,
    'art:logo-clear': 2,
    ...allDetails(2),
  }),
];

const MENU: MenuTree = {
  title: 'Next Level',
  items: [
    {
      id: 'm:consoles',
      name: 'Consoles',
      display: 'Consoles',
      type: 'category',
      children: [
        {
          id: 's:nintendo-64',
          name: 'Nintendo 64',
          display: 'N64',
          type: 'system',
          systemId: 'nintendo-64',
          children: [],
        },
        {
          id: 's:sega-genesis',
          name: 'Genesis',
          display: 'Genesis',
          type: 'system',
          systemId: 'sega-genesis',
          children: [],
        },
      ],
    },
  ],
};

function setup() {
  const games = [gameRow(1, 'Sonic', { systemId: 'sega-genesis' })];
  const systems = HEALTH.map((h) => ({
    id: h.systemId,
    enabled: true,
    games: h.games,
    missing: 0,
    review: 0,
  }));
  const bridge = installFakeBridge({
    ...libraryResponses(games, systems),
    'frontend.menu': () => ok(MENU),
    'library.health': () => ok(HEALTH),
  });
  renderInShell(<LibraryApp />);
  return bridge;
}

const rowNames = (table: HTMLElement) =>
  within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent);

describe('System health (owner request 2026-11-02)', () => {
  it('Health on the home lists systems with their grade, worst first; the menu switch narrows', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(await screen.findByRole('button', { name: 'Health' }));
    const table = await screen.findByRole('table', { name: 'System health' });
    expect(rowNames(table)).toEqual(['Super Nintendo', 'sega-genesis', 'Nintendo 64']);
    const genesis = within(table).getByRole('row', { name: /sega-genesis/ });
    expect(within(genesis).getByText('C')).toBeInTheDocument();
    expect(within(genesis).getByText('0%')).toBeInTheDocument(); // ROMs found
    await user.click(screen.getByRole('button', { name: 'Name' }));
    expect(rowNames(table)).toEqual(['Nintendo 64', 'sega-genesis', 'Super Nintendo']);
    await user.click(screen.getByRole('checkbox', { name: 'Systems in my menu' }));
    expect(rowNames(table)).toEqual(['Nintendo 64', 'sega-genesis']);
  });

  it('a system shows what pulls it down; Show opens its games narrowed, Back returns to Health', async () => {
    const user = userEvent.setup();
    const bridge = setup();
    await user.click(await screen.findByRole('button', { name: 'Health' }));
    const table = await screen.findByRole('table', { name: 'System health' });
    await user.click(within(table).getByRole('button', { name: 'sega-genesis' }));
    const gaps = screen.getByRole('list', { name: 'What pulls sega-genesis down' });
    expect(
      within(gaps)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      expect.stringMatching(/^Missing: ROM file4/),
      expect.stringMatching(/^Missing: Video4/),
      expect.stringMatching(/^Missing: Box front2/),
    ]);
    const boxFront = within(gaps).getByText('Missing: Box front').closest('li');
    if (!boxFront) throw new Error('no Box front gap');
    await user.click(within(boxFront).getByRole('button', { name: 'Show' }));
    await waitFor(() => {
      const lists = bridge.calls
        .filter((call) => call.channel === 'library.games.list')
        .map((call) => call.input as GameListQuery);
      expect(lists.at(-1)).toMatchObject({
        scope: { kind: 'system', systemId: 'sega-genesis' },
        lacking: 'art:box-front',
      });
    });
    const chip = screen.getByRole('button', { name: 'Clear Missing: Box front' });
    await user.click(chip);
    await waitFor(() => {
      const last = bridge.calls.filter((call) => call.channel === 'library.games.list').at(-1);
      expect((last?.input as GameListQuery).lacking).toBeUndefined();
    });
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('table', { name: 'System health' })).toBeInTheDocument();
  });
});
