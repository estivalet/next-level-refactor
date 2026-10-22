import { defaultSettings, ok, type Settings } from '@nextlevel/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../../test-utils.tsx';
import { InputSection } from './InputSection.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

function setup(settings: Settings = defaultSettings()) {
  const bridge = installFakeBridge({
    'settings.get': () => ok({ kind: 'ok' as const, snapshot: { settings, revision: 0 } }),
    'settings.save': (input) => ok({ settings: input.settings, revision: 1 }),
  });
  renderInShell(<InputSection />);
  const saved = () => {
    const call = bridge.calls.find((c) => c.channel === 'settings.save');
    return (call?.input as { settings: Settings } | undefined)?.settings.input;
  };
  return { saved };
}

describe('InputSection', () => {
  it('FR-THM-3: shows each action with its keys and buttons', async () => {
    setup();
    const row = await screen.findByRole('group', { name: 'Favorite' });
    expect(within(row).getByText('X')).toBeVisible();
    expect(within(row).getByText('Y')).toBeVisible();
  });

  it('FR-THM-3: a captured key is added to the action and saved', async () => {
    const user = userEvent.setup();
    const { saved } = setup();
    const row = await screen.findByRole('group', { name: 'Random game' });
    await user.click(within(row).getByRole('button', { name: 'Add key for Random game' }));
    expect(within(row).getByText('Press a key… (Esc cancels)')).toBeVisible();
    fireEvent.keyDown(window, { code: 'KeyG', key: 'g' });
    expect(within(row).getByText('G')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved()?.keyboard.random).toEqual(['KeyR', 'KeyG']);
  });

  it('FR-THM-3: a duplicate key shows the field error and disables Save', async () => {
    const user = userEvent.setup();
    setup();
    const row = await screen.findByRole('group', { name: 'Hide' });
    await user.click(within(row).getByRole('button', { name: 'Add key for Hide' }));
    fireEvent.keyDown(window, { code: 'KeyX', key: 'x' });
    expect(
      within(row).getByText('This key or button is already used by another action.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('FR-THM-3: a binding can be removed and everything reset to defaults', async () => {
    const user = userEvent.setup();
    const { saved } = setup();
    const row = await screen.findByRole('group', { name: 'Search' });
    await user.click(within(row).getByRole('button', { name: 'Remove F from Search' }));
    expect(within(row).queryByText('F')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Reset all to defaults' }));
    expect(within(row).getByText('F')).toBeVisible();

    const delay = screen.getByRole('spinbutton', { name: 'Repeat delay (ms)' });
    await user.clear(delay);
    await user.type(delay, '300');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved()?.repeatDelayMs).toBe(300);
    expect(saved()?.keyboard.search).toEqual(['KeyF']);
  });
});
