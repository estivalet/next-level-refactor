import { defaultSettings, ok, type Settings, type StorageLocation } from '@nextlevel/shared';
import { screen } from '@testing-library/react';
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
  return { ...settings, storage: { locations } };
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
