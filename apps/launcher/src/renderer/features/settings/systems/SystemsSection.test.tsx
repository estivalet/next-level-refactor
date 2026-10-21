import { defaultSettings, ok, type Settings } from '@nextlevel/shared';
import { systemCatalog } from '@nextlevel/system-catalog';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../../test-utils.tsx';
import { SystemsSection } from './SystemsSection.tsx';

// jsdom lays nothing out; give elements a 640×480 client box (what the virtualizer measures)
// so it renders a window of rows.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(480);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640);
});

afterEach(() => {
  setBridgeForTests(null);
  vi.restoreAllMocks();
});

function setup(systems: Settings['systems'] = {}) {
  const settings = { ...defaultSettings(), systems };
  const bridge = installFakeBridge({
    'systems.catalog': () => ok([...systemCatalog()]),
    'settings.get': () => ok({ kind: 'ok' as const, snapshot: { settings, revision: 0 } }),
    'settings.save': (input) => ok({ settings: input.settings, revision: 1 }),
  });
  renderInShell(<SystemsSection />);
  const saved = () => {
    const call = bridge.calls.find((c) => c.channel === 'settings.save');
    return (call?.input as { settings: Settings } | undefined)?.settings.systems;
  };
  return { saved };
}

const list = () => within(screen.getByRole('list', { name: 'Systems' }));

describe('SystemsSection', () => {
  it('NFR-A11Y-1: the 438-system list is virtualized and search narrows it', async () => {
    const user = userEvent.setup();
    setup();
    expect(await screen.findByText('0 of 438 enabled')).toBeVisible();
    expect(list().getAllByRole('listitem').length).toBeLessThan(60);

    await user.type(screen.getByRole('searchbox', { name: 'Search systems' }), 'nintendo 64');
    expect(
      list()
        .getAllByRole('listitem')
        .map((item) => item.dataset['systemId']),
    ).toEqual(['nintendo-64', 'nintendo-64dd']);
  });

  it('FR-EMU-1: enabling a system and saving writes systems[id].enabled', async () => {
    const user = userEvent.setup();
    const { saved } = setup();
    await user.type(await screen.findByRole('searchbox', { name: 'Search systems' }), 'saturn');
    await user.click(screen.getByRole('switch', { name: 'Enable Sega Saturn' }));
    expect(screen.getByText('1 of 438 enabled')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved()).toEqual({ 'sega-saturn': { enabled: true } });
  });

  it('FR-EMU-1: "Enabled only" lists just the enabled systems', async () => {
    const user = userEvent.setup();
    setup({ 'sega-saturn': { enabled: true } });
    await user.click(await screen.findByRole('checkbox', { name: 'Enabled only' }));
    expect(
      list()
        .getAllByRole('listitem')
        .map((item) => item.dataset['systemId']),
    ).toEqual(['sega-saturn']);
  });

  it('FR-LIB-2: editing folder name and extensions saves overrides', async () => {
    const user = userEvent.setup();
    const { saved } = setup();
    await user.type(
      await screen.findByRole('searchbox', { name: 'Search systems' }),
      'nintendo 64',
    );
    await user.click(screen.getByRole('button', { name: 'Edit Nintendo 64' }));
    const editor = within(screen.getByRole('region', { name: 'Nintendo 64' }));
    await user.type(editor.getByRole('textbox', { name: 'ROM folder name' }), 'N64');
    await user.type(editor.getByRole('textbox', { name: 'File extensions' }), 'z64, .N64');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved()).toEqual({
      'nintendo-64': { enabled: false, folderName: 'N64', extensions: ['z64', 'n64'] },
    });
  });

  it('FR-SET-2: an invalid extension shows an error and blocks Save', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(
      await screen.findByRole('searchbox', { name: 'Search systems' }),
      'nintendo 64',
    );
    await user.click(screen.getByRole('button', { name: 'Edit Nintendo 64' }));
    const editor = within(screen.getByRole('region', { name: 'Nintendo 64' }));
    await user.type(editor.getByRole('textbox', { name: 'File extensions' }), 'z*64');
    expect(editor.getByText('This value is not valid.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('FR-LIB-2: Reset to defaults removes the overrides', async () => {
    const user = userEvent.setup();
    const { saved } = setup({ 'nintendo-64': { enabled: false, folderName: 'N64' } });
    await user.type(
      await screen.findByRole('searchbox', { name: 'Search systems' }),
      'nintendo 64',
    );
    await user.click(screen.getByRole('button', { name: 'Edit Nintendo 64' }));
    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved()).toEqual({});
  });
});
