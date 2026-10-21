import { defaultSettings, err, ok, type ScanStatus, type Settings } from '@nextlevel/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell, type FakeResponses } from '../../test-utils.tsx';
import { StorageSection } from '../settings/StorageSection.tsx';

// jsdom lays nothing out; give elements a client box so the virtualized results render rows.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(240);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640);
});
afterEach(() => {
  setBridgeForTests(null);
  vi.restoreAllMocks();
});

const LOCATION = {
  id: '0192b2a0-0000-7000-8000-000000000001',
  name: 'Roms',
  path: 'E:\\roms',
  priority: 1,
};
const IDLE: ScanStatus = { running: false, progress: null, last: null };
const CATALOG = [
  {
    id: 'nintendo-64',
    name: 'Nintendo 64',
    kind: 'console' as const,
    extensions: ['z64'],
    defaultFolderName: 'Nintendo 64',
    scraper: {},
    presetProfiles: [],
    aliases: [],
  },
];

function setup(responses: FakeResponses = {}, locations = [LOCATION]) {
  const settings: Settings = { ...defaultSettings(), storage: { locations } };
  const bridge = installFakeBridge({
    'settings.get': () => ok({ kind: 'ok' as const, snapshot: { settings, revision: 0 } }),
    'systems.catalog': () => ok(CATALOG),
    'scan.status': () => ok(IDLE),
    'scan.start': () =>
      ok({
        running: true,
        progress: { scanId: 's', systemsDone: 0, systemsTotal: 1, systemId: null, filesSeen: 0 },
        last: null,
      }),
    'scan.cancel': () => ok(IDLE),
    ...responses,
  });
  renderInShell(<StorageSection />);
  return bridge;
}

describe('ScanPanel', () => {
  it('FR-LIB-3: Scan now starts a scan and shows progress with Cancel', async () => {
    const user = userEvent.setup();
    const bridge = setup();
    await user.click(await screen.findByRole('button', { name: 'Scan now' }));
    expect(bridge.channels()).toContain('scan.start');

    bridge.emit('scan.progress', {
      scanId: 's',
      systemsDone: 1,
      systemsTotal: 4,
      systemId: 'nintendo-64',
      filesSeen: 120,
    });
    const bar = await screen.findByRole('progressbar', { name: 'Scan progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '1');
    expect(bar).toHaveAttribute('aria-valuemax', '4');
    expect(screen.getByText('Scanning Nintendo 64 · 120 files found')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Cancel scan' }));
    expect(bridge.channels()).toContain('scan.cancel');
  });

  it('FR-LIB-3: the finished summary shows counts and enabled systems', async () => {
    const bridge = setup({ 'systems.list': () => ok([]) });
    await screen.findByRole('button', { name: 'Scan now' });
    bridge.emit('scan.finished', {
      scanId: 's',
      startedAt: '2026-10-21T12:00:00.000Z',
      finishedAt: '2026-10-21T12:00:05.000Z',
      outcome: 'completed',
      systems: [
        { systemId: 'nintendo-64', present: 2, added: 1, moved: 0, restored: 0, missing: 1 },
      ],
      enabledSystemIds: ['nintendo-64'],
    });
    expect(
      await screen.findByText('2 games in 1 system · 1 new · 1 missing · 1 system turned on'),
    ).toBeVisible();
    expect(screen.getByRole('list', { name: 'Scan results' })).toHaveTextContent(
      'Nintendo 642 games · 1 missing',
    );
  });

  it('FR-LIB-3: a cancelled scan says so', async () => {
    const bridge = setup();
    await screen.findByRole('button', { name: 'Scan now' });
    bridge.emit('scan.finished', {
      scanId: 's',
      startedAt: '2026-10-21T12:00:00.000Z',
      finishedAt: '2026-10-21T12:00:05.000Z',
      outcome: 'cancelled',
      systems: [],
      enabledSystemIds: [],
    });
    expect(await screen.findByText(/Scan cancelled/)).toBeVisible();
  });

  it('FR-LIB-3: Scan now is disabled with unsaved storage changes', async () => {
    const user = userEvent.setup();
    setup();
    const name = await screen.findByRole('textbox', { name: 'Name of location 1' });
    await user.type(name, 'x');
    expect(screen.getByRole('button', { name: 'Scan now' })).toBeDisabled();
    expect(screen.getByText('Save your changes before scanning.')).toBeVisible();
  });

  it('FR-LIB-3: Scan now is disabled without storage locations', async () => {
    setup({}, []);
    expect(await screen.findByRole('button', { name: 'Scan now' })).toBeDisabled();
    expect(screen.getByText('Add a storage location to scan.')).toBeVisible();
  });

  it('FR-LIB-3: an unavailable library offers Open data folder', async () => {
    const user = userEvent.setup();
    const bridge = setup({
      'scan.status': () => err('LIBRARY_UNAVAILABLE', 'errors.libraryUnavailable'),
      'app.openPath': () => ok(undefined),
    });
    expect(await screen.findByText('The game library could not be opened.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Open data folder' }));
    expect(bridge.calls).toContainEqual({ channel: 'app.openPath', input: { key: 'data' } });
  });
});
