import { defaultSettings, err, ok, type Settings } from '@nextlevel/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { GeneralSection } from './GeneralSection.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

function withStart(startWithWindows: boolean): Settings {
  const settings = defaultSettings();
  return { ...settings, general: { ...settings.general, startWithWindows } };
}

describe('GeneralSection', () => {
  it('FR-SET-1: toggling Start with Windows shows the save bar; Save sends settings.save', async () => {
    const user = userEvent.setup();
    const bridge = installFakeBridge({
      'settings.save': (input) => ok({ settings: input.settings, revision: 1 }),
    });
    renderInShell(<GeneralSection />);
    const toggle = await screen.findByRole('switch', { name: 'Start with Windows' });
    expect(toggle).not.toBeChecked();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(bridge.calls).toContainEqual({
      channel: 'settings.save',
      input: { settings: withStart(true), baseRevision: 0 },
    });
    expect(await screen.findByRole('switch', { name: 'Start with Windows' })).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('Discard restores the saved values and hides the save bar', async () => {
    const user = userEvent.setup();
    installFakeBridge();
    renderInShell(<GeneralSection />);
    await user.click(await screen.findByRole('switch', { name: 'Start with Windows' }));
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.getByRole('switch', { name: 'Start with Windows' })).not.toBeChecked();
    expect(screen.queryByRole('button', { name: 'Discard' })).not.toBeInTheDocument();
  });

  it('CONFLICT shows the conflict message and reloads the settings', async () => {
    const user = userEvent.setup();
    const bridge = installFakeBridge({
      'settings.save': () => err('CONFLICT', 'errors.conflict'),
    });
    renderInShell(<GeneralSection />);
    await user.click(await screen.findByRole('switch', { name: 'Start with Windows' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText(
        'Settings changed since you opened them. The latest version was loaded.',
      ),
    ).toBeVisible();
    expect(bridge.channels().filter((channel) => channel === 'settings.get')).toHaveLength(2);
  });

  it('NFR-I18N-1: choosing a language in the draft does not switch the UI until saved', async () => {
    const user = userEvent.setup();
    installFakeBridge();
    renderInShell(<GeneralSection />);
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Language' }), 'pt-BR');
    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('pt-BR');
    expect(screen.getByRole('switch', { name: 'Start with Windows' })).toBeVisible();
  });

  it('NFR-A11Y-1: every field has a label and help text', async () => {
    installFakeBridge();
    renderInShell(<GeneralSection />);
    expect(await screen.findByRole('combobox', { name: 'Language' })).toHaveAccessibleDescription(
      'The language of the launcher.',
    );
    expect(screen.getByRole('switch', { name: 'Start with Windows' })).toHaveAccessibleDescription(
      'Open NextLevel automatically when you sign in to Windows.',
    );
  });
});
