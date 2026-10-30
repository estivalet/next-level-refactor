import { defaultSettings, err, ERROR_CODES, ok, type Settings } from '@nextlevel/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell, type FakeResponses } from '../../test-utils.tsx';
import { FoldersStep } from './FoldersStep.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

const MANAGED = {
  id: '0192f000-0000-7000-8000-0000000000c1',
  name: 'Catalog',
  path: 'E:\\NextLevel\\Catalog',
  priority: 1,
  managed: true,
};

function setup(responses: FakeResponses, settings: Settings = defaultSettings()) {
  installFakeBridge({
    'systems.catalog': () => ok([]),
    'systems.list': () => ok([]),
    ...responses,
  });
  const persisted: Settings[] = [];
  const persist = vi.fn((next: Settings) => {
    persisted.push(next);
    return Promise.resolve();
  });
  renderInShell(<FoldersStep settings={settings} persist={persist} next={vi.fn()} />);
  return { persisted, persist };
}

describe('wizard: game folders (US-B2, D45)', () => {
  it('folders with the same last name get distinct names; the same folder twice is refused', async () => {
    const u = userEvent.setup();
    const picks = ['D:\\ROMs', 'E:\\ROMs', 'D:\\ROMs'];
    const t = setup({ 'app.pickFolder': () => ok(picks.shift() ?? null) });
    for (let i = 0; i < 3; i += 1)
      await u.click(screen.getByRole('button', { name: 'Add folder…' }));
    expect(screen.getByRole('alert')).toHaveTextContent('This folder is already in the list.');
    expect(
      within(screen.getByRole('list', { name: 'Game folders' })).getAllByRole('listitem'),
    ).toHaveLength(2);
    await u.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(t.persisted).toHaveLength(1);
    });
    expect(t.persisted[0]?.storage.locations.map((l) => l.name)).toEqual(['ROMs', 'ROMs (2)']);
  });

  it('the Catalog games folder is shown read-only and kept last', async () => {
    const u = userEvent.setup();
    const settings = defaultSettings();
    settings.storage = { ...settings.storage, locations: [MANAGED] };
    setup({ 'app.pickFolder': () => ok('D:\\Games') }, settings);
    await u.click(screen.getByRole('button', { name: 'Add folder…' }));
    const items = within(screen.getByRole('list', { name: 'Game folders' })).getAllByRole(
      'listitem',
    );
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('D:\\Games'),
      expect.stringContaining('Catalog games'),
    ]);
    expect(within(items[1] as HTMLElement).queryByRole('button', { name: /Remove/ })).toBeNull();
  });

  it('a scan that cannot start says so and Scan now works again', async () => {
    const u = userEvent.setup();
    setup({
      'app.pickFolder': () => ok('D:\\Games'),
      'scan.start': () => err('BUSY', ERROR_CODES.BUSY),
    });
    await u.click(screen.getByRole('button', { name: 'Add folder…' }));
    await u.click(screen.getByRole('button', { name: 'Scan now' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("The scan couldn't start.");
    expect(screen.getByRole('button', { name: 'Scan now' })).toBeEnabled();
    expect(screen.queryByText(/Scanning/)).toBeNull();
  });
});
