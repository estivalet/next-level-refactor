import { defaultSettings, ok, type Settings } from '@nextlevel/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { StorageSection } from './StorageSection.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

function setup() {
  const bridge = installFakeBridge({
    'settings.get': () =>
      ok({ kind: 'ok' as const, snapshot: { settings: defaultSettings(), revision: 0 } }),
    'settings.save': (input) => ok({ settings: input.settings, revision: 1 }),
  });
  renderInShell(<StorageSection />);
  const saved = () => {
    const call = bridge.calls.find((c) => c.channel === 'settings.save');
    return (call?.input as { settings: Settings } | undefined)?.settings.storage.folderFilters;
  };
  return { saved };
}

describe('Settings → Storage → Folder filters (FR-LIB-18, US-C12)', () => {
  it('US-C12: defaults show ! and + ticked and Official outside', async () => {
    setup();
    expect(await screen.findByRole('checkbox', { name: '!' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '+' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '#' })).not.toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Filter for games in no such folder' })).toHaveValue(
      'Official',
    );
  });

  it('US-C12: a rename, a prefix and an empty outside filter are saved', async () => {
    const user = userEvent.setup();
    const { saved } = setup();
    await user.click(await screen.findByRole('checkbox', { name: '+' }));
    await user.clear(screen.getByRole('textbox', { name: 'Filter for games in no such folder' }));
    await user.click(screen.getByRole('button', { name: 'Add rename' }));
    await user.type(screen.getByRole('textbox', { name: 'Folder of rename 1' }), '! Homebrews');
    await user.type(screen.getByRole('textbox', { name: 'Filter of rename 1' }), 'Homebrew');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved()).toEqual({
      prefixes: ['!'],
      outside: '',
      renames: [{ folder: '! Homebrews', filter: 'Homebrew' }],
    });
  });

  it('FR-LIB-18: a repeated rename folder shows an error and disables Save', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(await screen.findByRole('button', { name: 'Add rename' }));
    await user.type(screen.getByRole('textbox', { name: 'Folder of rename 1' }), 'Homebrews');
    await user.type(screen.getByRole('textbox', { name: 'Filter of rename 1' }), 'Homebrew');
    await user.click(screen.getByRole('button', { name: 'Add rename' }));
    await user.type(screen.getByRole('textbox', { name: 'Folder of rename 2' }), '! homebrews');
    await user.type(screen.getByRole('textbox', { name: 'Filter of rename 2' }), 'Other');
    expect(await screen.findByText('This folder is already renamed.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Remove rename 2' }));
    expect(screen.queryByText('This folder is already renamed.')).toBeNull();
  });
});
