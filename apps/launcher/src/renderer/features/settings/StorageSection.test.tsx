import { defaultSettings, ok, type Settings, type StorageLocation } from '@nextlevel/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell, type FakeResponses } from '../../test-utils.tsx';
import { StorageSection } from './StorageSection.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

const A: StorageLocation = {
  id: '01928c3e-0000-7000-8000-00000000000a',
  name: '2TB',
  path: 'E:\\NextLevel\\systems',
  priority: 1,
};
const B: StorageLocation = {
  id: '01928c3e-0000-7000-8000-00000000000b',
  name: '16TB',
  path: 'E:\\roms',
  priority: 2,
};

function withLocations(locations: StorageLocation[]): Settings {
  const settings = defaultSettings();
  return { ...settings, storage: { ...settings.storage, locations } };
}

function setup(locations: StorageLocation[], responses: FakeResponses = {}) {
  const bridge = installFakeBridge({
    'settings.get': () =>
      ok({ kind: 'ok' as const, snapshot: { settings: withLocations(locations), revision: 0 } }),
    'settings.save': (input) => ok({ settings: input.settings, revision: 1 }),
    ...responses,
  });
  renderInShell(<StorageSection />);
  const savedLocations = () => {
    const call = bridge.calls.find((c) => c.channel === 'settings.save');
    return (call?.input as { settings: Settings } | undefined)?.settings.storage.locations;
  };
  return { bridge, savedLocations };
}

describe('StorageSection', () => {
  it('FR-LIB-1: Add location picks a folder and adds a row named after it; Save sends priority 1', async () => {
    const user = userEvent.setup();
    const { savedLocations } = setup([], {
      'app.pickFolder': () => ok('F:\\Games\\Retro'),
    });
    await user.click(await screen.findByRole('button', { name: 'Add location…' }));
    expect(screen.getByRole('textbox', { name: 'Name of location 1' })).toHaveValue('Retro');
    expect(screen.getByText('F:\\Games\\Retro')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(savedLocations()).toEqual([
      {
        id: expect.stringMatching(/^[0-9a-f-]{36}$/) as unknown,
        name: 'Retro',
        path: 'F:\\Games\\Retro',
        priority: 1,
      },
    ]);
  });

  it('FR-LIB-1: Move up reorders and renumbers priorities', async () => {
    const user = userEvent.setup();
    const { savedLocations } = setup([A, B]);
    await user.click(await screen.findByRole('button', { name: 'Move 16TB up' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(savedLocations()).toEqual([
      { ...B, priority: 1 },
      { ...A, priority: 2 },
    ]);
  });

  it('FR-LIB-1: a duplicate path shows a field error and disables Save', async () => {
    const user = userEvent.setup();
    setup([B], { 'app.pickFolder': () => ok('e:/ROMS/') });
    await user.click(await screen.findByRole('button', { name: 'Add location…' }));
    expect(screen.getByText('This folder is already a storage location.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('removing the last location shows the empty state and still saves', async () => {
    const user = userEvent.setup();
    const { savedLocations } = setup([A]);
    await user.click(await screen.findByRole('button', { name: 'Remove 2TB' }));
    expect(screen.getByText(/No storage locations yet/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(savedLocations()).toEqual([]);
  });

  it('cancelling the folder picker changes nothing', async () => {
    const user = userEvent.setup();
    setup([], { 'app.pickFolder': () => ok(null) });
    await user.click(await screen.findByRole('button', { name: 'Add location…' }));
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('FR-LIB-1: renaming a location is saved', async () => {
    const user = userEvent.setup();
    const { savedLocations } = setup([A]);
    const name = await screen.findByRole('textbox', { name: 'Name of location 1' });
    await user.clear(name);
    await user.type(name, 'Main');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(savedLocations()).toEqual([{ ...A, name: 'Main' }]);
  });
});

describe('StorageSection art folders', () => {
  it('FR-THM-2: Browse sets the art folder and Clear removes the theme packs folder', async () => {
    const user = userEvent.setup();
    const bridge = installFakeBridge({
      'settings.get': () =>
        ok({
          kind: 'ok' as const,
          snapshot: {
            settings: {
              ...defaultSettings(),
              storage: {
                ...defaultSettings().storage,
                themesPath: 'E:\\NextLevel\\themes',
              },
            },
            revision: 0,
          },
        }),
      'settings.save': (input) => ok({ settings: input.settings, revision: 1 }),
      'app.pickFolder': () => ok('E:\\NextLevel\\assets'),
    });
    renderInShell(<StorageSection />);
    const art = await screen.findByRole('group', { name: 'Art folder' });
    expect(within(art).getByText('Not set')).toBeVisible();
    await user.click(within(art).getByRole('button', { name: 'Browse…' }));
    expect(within(art).getByText('E:\\NextLevel\\assets')).toBeVisible();
    const packs = screen.getByRole('group', { name: 'Theme packs folder' });
    await user.click(within(packs).getByRole('button', { name: 'Clear' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const call = bridge.calls.find((c) => c.channel === 'settings.save');
    const storage = (call?.input as { settings: Settings }).settings.storage;
    expect(storage).toMatchObject({ assetsPath: 'E:\\NextLevel\\assets', themesPath: null });
  });
});

describe('StorageSection keyboard focus (NFR-A11Y-1)', () => {
  it('moving a location to the top keeps focus on that location', async () => {
    const user = userEvent.setup();
    setup([A, B]);
    await user.click(await screen.findByRole('button', { name: 'Move 16TB up' }));
    expect(screen.getByRole('button', { name: 'Move 16TB down' })).toHaveFocus();
  });

  it('removing the last location moves focus to Add location', async () => {
    const user = userEvent.setup();
    setup([A]);
    await user.click(await screen.findByRole('button', { name: 'Remove 2TB' }));
    expect(screen.getByRole('button', { name: 'Add location…' })).toHaveFocus();
  });

  it('removing a location moves focus to the next one', async () => {
    const user = userEvent.setup();
    setup([A, B]);
    await user.click(await screen.findByRole('button', { name: 'Remove 2TB' }));
    expect(screen.getByRole('textbox', { name: 'Name of location 1' })).toHaveFocus();
  });
});

describe('StorageSection media location (FR-SCR-4)', () => {
  const IDLE = { running: false, progress: null, last: null };
  const savedMedia = (bridge: ReturnType<typeof installFakeBridge>) =>
    (
      bridge.calls.filter((c) => c.channel === 'settings.save').pop()?.input as
        { settings: Settings } | undefined
    )?.settings.storage.media;

  it('FR-SCR-4: choosing a central folder picks it; Save stores it; then Rescan to update art offers Scan all', async () => {
    const user = userEvent.setup();
    const { bridge } = setup([A], {
      'app.pickFolder': () => ok('G:\\Art'),
      'scan.status': () => ok(IDLE),
      'scan.start': () => ok(IDLE),
    });
    const place = await screen.findByRole('group', { name: 'Where scraped art goes' });
    expect(within(place).getByRole('radio', { name: 'Next to the ROMs' })).toBeChecked();
    await user.click(within(place).getByRole('radio', { name: 'One central folder' }));
    expect(within(place).getByText('G:\\Art')).toBeVisible();
    expect(within(place).getByText(/Rescan to update art/)).toBeVisible();
    expect(within(place).getByRole('button', { name: 'Scan all' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(savedMedia(bridge)).toEqual({ mode: 'central', path: 'G:\\Art' });
    const scanAll = await within(place).findByRole('button', { name: 'Scan all' });
    await expect.poll(() => scanAll.hasAttribute('disabled')).toBe(false);
    await user.click(scanAll);
    expect(bridge.calls.some((c) => c.channel === 'scan.start')).toBe(true);
  });

  it('FR-SCR-4: cancelling the folder picker keeps Next to the ROMs', async () => {
    const user = userEvent.setup();
    setup([A], { 'app.pickFolder': () => ok(null), 'scan.status': () => ok(IDLE) });
    const place = await screen.findByRole('group', { name: 'Where scraped art goes' });
    await user.click(within(place).getByRole('radio', { name: 'One central folder' }));
    expect(within(place).getByRole('radio', { name: 'Next to the ROMs' })).toBeChecked();
    expect(within(place).queryByText(/Rescan to update art/)).not.toBeInTheDocument();
  });
});
