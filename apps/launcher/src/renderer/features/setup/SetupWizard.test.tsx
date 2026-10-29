import { defaultSettings, ok, type Settings } from '@nextlevel/shared';
import { systemCatalog } from '@nextlevel/system-catalog';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell, type FakeResponses } from '../../test-utils.tsx';
import { SetupWizard } from './SetupWizard.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

function setup(responses: FakeResponses = {}, start: Settings = defaultSettings()) {
  let current = start;
  let revision = 0;
  const saved: Settings[] = [];
  const bridge = installFakeBridge({
    'settings.get': () => ok({ kind: 'ok' as const, snapshot: { settings: current, revision } }),
    'settings.save': (input) => {
      current = input.settings;
      revision += 1;
      saved.push(input.settings);
      return ok({ settings: current, revision });
    },
    'systems.catalog': () => ok([...systemCatalog()]),
    'systems.list': () => ok([]),
    ...responses,
  });
  const onDone = vi.fn();
  renderInShell(<SetupWizard onDone={onDone} />);
  return { bridge, saved, onDone, last: () => saved.at(-1) };
}

const heading = () => screen.getByRole('heading', { level: 2 });

describe('first-run wizard (FR-ONB-1, D48)', () => {
  it('FR-ONB-1: five steps, each skippable, Back works; skipping everything offers the catalog', async () => {
    const u = userEvent.setup();
    const t = setup();
    expect(await screen.findByRole('heading', { name: 'Choose your systems' })).toBeVisible();
    expect(screen.getByText('Step 1 of 5')).toBeVisible();
    await u.click(screen.getByRole('button', { name: 'Skip' }));
    expect(heading()).toHaveTextContent('Add your game folders');
    await u.click(screen.getByRole('button', { name: 'Back' }));
    expect(heading()).toHaveTextContent('Choose your systems');
    for (const name of [
      'Add your game folders',
      'Set up emulators',
      'Pick a look',
      "You're all set",
    ]) {
      await u.click(screen.getByRole('button', { name: 'Skip' }));
      expect(heading()).toHaveTextContent(name);
    }
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    await u.click(screen.getByRole('button', { name: 'Browse catalog' }));
    await waitFor(() => {
      expect(t.onDone).toHaveBeenCalledWith('catalog');
    });
    expect(t.last()?.general.setupCompletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('popular systems are pre-checked; Next saves the choice', async () => {
    const u = userEvent.setup();
    const t = setup();
    const nes = await screen.findByRole('checkbox', { name: 'Nintendo NES' });
    expect(nes).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Nintendo 64' })).toBeChecked();
    await u.click(screen.getByRole('checkbox', { name: 'Nintendo 64' }));
    await u.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(t.last()?.systems['nintendo-nes']?.enabled).toBe(true);
    });
    expect(t.last()?.systems['nintendo-64']?.enabled ?? false).toBe(false);
  });

  it('US-B2: two folders go in priority order; Scan now saves them and scans, with counts per system', async () => {
    const u = userEvent.setup();
    const folders = ['F:\\Games\\Main', 'G:\\More'];
    const t = setup({
      'app.pickFolder': () => ok(folders.shift() ?? null),
      'scan.start': () => ok({ running: true, progress: null, last: null }),
      'systems.list': () =>
        ok([{ id: 'nintendo-nes', enabled: true, games: 2, missing: 0, review: 0 }]),
    });
    await u.click(await screen.findByRole('button', { name: 'Skip' }));
    await u.click(screen.getByRole('button', { name: 'Add folder…' }));
    await u.click(screen.getByRole('button', { name: 'Add folder…' }));
    const list = screen.getByRole('list', { name: 'Game folders' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([expect.stringContaining('Main'), expect.stringContaining('More')]);
    await u.click(screen.getByRole('button', { name: 'Scan now' }));
    await waitFor(() => {
      expect(t.bridge.channels()).toContain('scan.start');
    });
    expect(t.last()?.storage.locations.map((l) => [l.path, l.priority])).toEqual([
      ['F:\\Games\\Main', 1],
      ['G:\\More', 2],
    ]);
    t.bridge.emit('scan.finished', {
      scanId: 's1',
      startedAt: '2026-10-30T10:00:00.000Z',
      finishedAt: '2026-10-30T10:00:01.000Z',
      outcome: 'completed',
      systems: [],
      enabledSystemIds: [],
    });
    expect(await screen.findByText('Nintendo NES · 2 games')).toBeVisible();
  });

  it('the Emulators step lists enabled systems with games: Locate executable… and Official site', async () => {
    const u = userEvent.setup();
    const start = defaultSettings();
    start.systems = { 'nintendo-nes': { enabled: true } } as Settings['systems'];
    const t = setup(
      {
        'systems.list': () =>
          ok([{ id: 'nintendo-nes', enabled: true, games: 2, missing: 0, review: 0 }]),
        'app.pickFile': () => ok('C:\\Emu\\retroarch.exe'),
      },
      start,
    );
    await u.click(await screen.findByRole('button', { name: 'Skip' }));
    await u.click(screen.getByRole('button', { name: 'Skip' }));
    const row = (await screen.findByText('Nintendo NES')).closest('li') as HTMLElement;
    expect(within(row).getByRole('link', { name: 'Official site' })).toHaveAttribute(
      'href',
      'https://www.retroarch.com/',
    );
    await u.click(within(row).getByRole('button', { name: 'Locate executable…' }));
    await waitFor(() => {
      expect(t.last()?.emulators).toEqual([
        expect.objectContaining({ presetId: 'retroarch', executable: 'C:\\Emu\\retroarch.exe' }),
      ]);
    });
    expect(await within(row).findByText('Ready')).toBeVisible();
  });

  it('with games, Done says Start and lands nowhere special', async () => {
    const u = userEvent.setup();
    const t = setup({
      'systems.list': () =>
        ok([{ id: 'nintendo-nes', enabled: true, games: 2, missing: 0, review: 0 }]),
    });
    for (let i = 0; i < 4; i += 1)
      await u.click(await screen.findByRole('button', { name: 'Skip' }));
    await u.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => {
      expect(t.onDone).toHaveBeenCalledWith(null);
    });
  });
});
