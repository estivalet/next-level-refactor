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

function setup(systems: Settings['systems'] = {}, extra: Partial<Settings> = {}) {
  const settings = { ...defaultSettings(), systems, ...extra };
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
    // The overrides go; the user's "off" stays so a scan won't turn the system on (FR-LIB-3).
    expect(saved()).toEqual({ 'nintendo-64': { enabled: false } });
  });
});

describe('SystemsSection review fixes', () => {
  async function openEditor() {
    const user = userEvent.setup();
    setup();
    await user.type(
      await screen.findByRole('searchbox', { name: 'Search systems' }),
      'nintendo 64',
    );
    await user.click(screen.getByRole('button', { name: 'Edit Nintendo 64' }));
    const editor = within(screen.getByRole('region', { name: 'Nintendo 64' }));
    return { user, editor };
  }

  it('FR-SET-2: the editor stays open while its values are invalid', async () => {
    const { user, editor } = await openEditor();
    await user.type(editor.getByRole('textbox', { name: 'File extensions' }), 'z*64');
    await user.click(editor.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('region', { name: 'Nintendo 64' })).toBeVisible();
    expect(screen.getByText('This value is not valid.')).toBeVisible();
  });

  it('Discard also clears the extensions box', async () => {
    const { user, editor } = await openEditor();
    await user.type(editor.getByRole('textbox', { name: 'File extensions' }), 'z*64');
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(editor.getByRole('textbox', { name: 'File extensions' })).toHaveValue('');
  });

  it('NFR-A11Y-1: closing the editor returns focus to the row Edit button', async () => {
    const { user, editor } = await openEditor();
    await user.click(editor.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('button', { name: 'Edit Nintendo 64' })).toHaveFocus();
  });

  it('FR-EMU-4: the system default profile lists only profiles for that system', async () => {
    const user = userEvent.setup();
    const emulatorId = '01900000-0000-7000-8000-0000000000e1';
    const profile = (id: string, name: string, systems: string[]) => ({
      id,
      name,
      emulatorId,
      systems,
      args: ['{rom}'],
      archives: 'pass' as const,
      env: {},
    });
    const { saved } = setup(
      {},
      {
        emulators: [{ id: emulatorId, name: 'RetroArch', executable: 'C:\\RA\\retroarch.exe' }],
        profiles: [
          profile('01900000-0000-7000-8000-000000000001', 'RA SNES', ['snes']),
          profile('01900000-0000-7000-8000-000000000002', 'RA N64', ['nintendo-64']),
        ],
      },
    );
    await user.type(
      await screen.findByRole('searchbox', { name: 'Search systems' }),
      'nintendo 64',
    );
    await user.click(screen.getByRole('button', { name: 'Edit Nintendo 64' }));
    const editor = within(screen.getByRole('region', { name: 'Nintendo 64' }));
    const select = editor.getByRole('combobox', { name: 'Emulator profile' });
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Automatic (first profile for this system)', 'RA N64']);
    await user.selectOptions(select, 'RA N64');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved()?.['nintendo-64']).toEqual({
      enabled: false,
      defaultProfileId: '01900000-0000-7000-8000-000000000002',
    });
  });
});
