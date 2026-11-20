import { defaultSettings, ok, type Settings } from '@nextlevel/shared';
import { systemCatalog } from '@nextlevel/system-catalog';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../../test-utils.tsx';
import { SystemsSection } from './SystemsSection.tsx';

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(480);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640);
});
afterEach(() => {
  setBridgeForTests(null);
  vi.restoreAllMocks();
});

const LOCATIONS: Settings['storage']['locations'] = [
  { id: '0192b2a0-0000-7000-8000-000000000001', name: 'D', path: 'D:\\Roms', priority: 1 },
  { id: '0192b2a0-0000-7000-8000-000000000002', name: 'E', path: 'E:\\More', priority: 2 },
];

function setup(options: { systems?: Settings['systems']; picks?: Array<string | null> } = {}) {
  const base = defaultSettings();
  const settings: Settings = {
    ...base,
    storage: { ...base.storage, locations: LOCATIONS },
    systems: options.systems ?? {},
  };
  const picks = [...(options.picks ?? [])];
  const bridge = installFakeBridge({
    'systems.catalog': () => ok([...systemCatalog()]),
    'settings.get': () => ok({ kind: 'ok' as const, snapshot: { settings, revision: 0 } }),
    'settings.save': (input) => ok({ settings: input.settings, revision: 1 }),
    'app.pickFolder': () => ok(picks.shift() ?? null),
  });
  renderInShell(<SystemsSection />);
  const saved = () =>
    (
      bridge.calls.find((c) => c.channel === 'settings.save')?.input as
        { settings: Settings } | undefined
    )?.settings.systems;
  return { saved };
}

async function openSwitch(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByRole('searchbox', { name: 'Search systems' }), 'switch');
  await user.click(screen.getByRole('button', { name: 'Edit Nintendo Switch' }));
  const editor = within(screen.getByRole('region', { name: 'Nintendo Switch' }));
  return within(editor.getByRole('group', { name: 'Ignore when scanning' }));
}

describe('Ignore when scanning (FR-LIB-15, US-D8)', () => {
  it('FR-LIB-15: no system has a default; a typed pattern is added and saved', async () => {
    const user = userEvent.setup();
    const { saved } = setup();
    const field = await openSwitch(user);
    expect(field.getByText('Nothing is ignored.')).toBeVisible();

    await user.type(field.getByRole('textbox', { name: 'Name pattern' }), ' *updates_dlcs {Enter}');
    await user.type(field.getByRole('textbox', { name: 'Name pattern' }), '*[[v*');
    await user.click(field.getByRole('button', { name: 'Add' }));
    expect(
      within(field.getByRole('list', { name: 'Ignored when scanning' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Name*updates_dlcs', 'Name*[v*']);
    expect(field.getByRole('textbox', { name: 'Name pattern' })).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved()).toEqual({
      'nintendo-switch': {
        enabled: false,
        scanExclusions: [
          { kind: 'pattern', pattern: '*updates_dlcs' },
          { kind: 'pattern', pattern: '*[v*' },
        ],
      },
    });
  });

  it('FR-LIB-15: an empty, repeated or path-like pattern cannot be added', async () => {
    const user = userEvent.setup();
    setup({
      systems: {
        'nintendo-switch': {
          enabled: true,
          scanExclusions: [{ kind: 'pattern', pattern: '*[v*' }],
        },
      },
    });
    const field = await openSwitch(user);
    const input = field.getByRole('textbox', { name: 'Name pattern' });
    const add = field.getByRole('button', { name: 'Add' });
    expect(add).toBeDisabled();
    await user.type(input, '*[[V*');
    expect(add).toBeDisabled();
    expect(field.getByText('This entry is already in the list.')).toBeVisible();
    await user.clear(input);
    await user.type(input, 'a\\b');
    expect(add).toBeDisabled();
    expect(field.getByText('Type one name, without \\ / : < > " | or ?.')).toBeVisible();
  });

  it('US-D8: a picked folder inside the system folder is kept relative; outside is refused', async () => {
    const user = userEvent.setup();
    const { saved } = setup({
      picks: [
        'C:\\Elsewhere',
        'E:\\More\\Nintendo Switch\\_review_updates_dlcs',
        'd:\\roms\\nintendo switch\\_REVIEW_UPDATES_DLCS',
      ],
    });
    const field = await openSwitch(user);
    await user.click(field.getByRole('button', { name: 'Add folder…' }));
    expect(await field.findByText("Pick a folder inside this system's ROM folder.")).toBeVisible();

    await user.click(field.getByRole('button', { name: 'Add folder…' }));
    expect(await field.findByText('_review_updates_dlcs')).toBeVisible();
    expect(field.queryByText("Pick a folder inside this system's ROM folder.")).toBeNull();

    await user.click(field.getByRole('button', { name: 'Add folder…' }));
    expect(await field.findByText('This entry is already in the list.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved()?.['nintendo-switch']?.scanExclusions).toEqual([
      { kind: 'folder', path: '_review_updates_dlcs' },
    ]);
  });

  it('FR-LIB-15: an entry can be removed', async () => {
    const user = userEvent.setup();
    const { saved } = setup({
      systems: {
        'nintendo-switch': {
          enabled: true,
          scanExclusions: [
            { kind: 'pattern', pattern: '*[v*' },
            { kind: 'folder', path: 'updates_dlcs' },
          ],
        },
      },
    });
    const field = await openSwitch(user);
    await user.click(field.getByRole('button', { name: 'Remove *[v*' }));
    await user.click(field.getByRole('button', { name: 'Remove updates_dlcs' }));
    expect(field.getByText('Nothing is ignored.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved()).toEqual({ 'nintendo-switch': { enabled: true } });
  });

  it('FR-LIB-15, FR-EMU-11: a custom system has its own list, under its own folder', async () => {
    const user = userEvent.setup();
    const { saved } = setup({ picks: ['D:\\Roms\\Nintendo Switch 2\\updates'] });
    await user.click(await screen.findByRole('button', { name: 'Add system' }));
    const form = within(screen.getByRole('form', { name: 'New system' }));
    await user.type(form.getByRole('textbox', { name: 'Name' }), 'Nintendo Switch 2');
    await user.type(form.getByRole('textbox', { name: 'File extensions' }), 'xci, nsp');
    await user.click(form.getByRole('button', { name: 'Add' }));
    const editor = within(screen.getByRole('region', { name: 'Nintendo Switch 2' }));
    const field = within(editor.getByRole('group', { name: 'Ignore when scanning' }));
    await user.click(field.getByRole('button', { name: 'Add folder…' }));
    expect(await field.findByText('updates')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved()?.['custom-nintendo-switch-2']?.scanExclusions).toEqual([
      { kind: 'folder', path: 'updates' },
    ]);
  });
});
