import { defaultSettings, err, ok, type Settings } from '@nextlevel/shared';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('NFR-A11Y-1: after a save, keyboard focus returns to the first field', async () => {
    const user = userEvent.setup();
    installFakeBridge({
      'settings.save': (input) => ok({ settings: input.settings, revision: 1 }),
    });
    renderInShell(<GeneralSection />);
    await user.click(await screen.findByRole('switch', { name: 'Start with Windows' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const language = await screen.findByRole('combobox', { name: 'Language' });
    await vi.waitFor(() => {
      expect(language).toHaveFocus();
    });
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
        'Settings changed since you opened them. Your unsaved edits were kept on top of the latest version.',
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
      'Open NextLevel automatically when you sign in to Windows. This adds a Windows startup entry (no files); turning it off removes it.',
    );
  });

  it('FR-THM-5: the boot target offers last theme, a chosen theme or the desktop', async () => {
    const user = userEvent.setup();
    const bridge = installFakeBridge({
      'settings.save': (input) => ok({ settings: input.settings, revision: 1 }),
    });
    renderInShell(<GeneralSection />);
    const target = await screen.findByRole('combobox', { name: 'Start in' });
    expect(target).toHaveValue('lastTheme');
    expect(screen.queryByRole('combobox', { name: 'Theme' })).toBeNull();
    await user.selectOptions(target, 'theme');
    const theme = screen.getByRole('combobox', { name: 'Theme' });
    expect(theme).toHaveValue('big-box');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const saved = bridge.calls.find((call) => call.channel === 'settings.save');
    expect((saved?.input as { settings: Settings }).settings.general.bootTarget).toEqual({
      kind: 'theme',
      themeId: 'big-box',
    });
  });

  it('FR-THM-5: an unknown chosen theme reads as Big Box in the picker', async () => {
    const settings = defaultSettings();
    installFakeBridge({
      'settings.get': () =>
        ok({
          kind: 'ok',
          snapshot: {
            settings: {
              ...settings,
              general: { ...settings.general, bootTarget: { kind: 'theme', themeId: 'gone' } },
            },
            revision: 0,
          },
        }),
    });
    renderInShell(<GeneralSection />);
    expect(await screen.findByRole('combobox', { name: 'Theme' })).toHaveValue('big-box');
  });

  it('FR-THM-4 (D7): Theme sounds on/off and volume are saved in themes.sound', async () => {
    const user = userEvent.setup();
    const bridge = installFakeBridge({
      'settings.save': (input) => ok({ settings: input.settings, revision: 1 }),
    });
    renderInShell(<GeneralSection />);
    const toggle = await screen.findByRole('switch', { name: 'Theme sounds' });
    const volume = screen.getByRole('slider', { name: 'Theme sound volume' });
    expect(toggle).toBeChecked();
    expect(volume).toHaveValue('50');
    fireEvent.change(volume, { target: { value: '30' } });
    await user.click(toggle);
    expect(volume).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const saved = bridge.calls.find((call) => call.channel === 'settings.save');
    expect((saved?.input as { settings: Settings }).settings.themes.sound).toEqual({
      enabled: false,
      volume: 30,
    });
  });

  it('D48: Run setup again clears setup completion when saved (the wizard shows at next start)', async () => {
    const user = userEvent.setup();
    const done = defaultSettings();
    done.general = { ...done.general, setupCompletedAt: '2026-10-01T00:00:00.000Z' };
    const bridge = installFakeBridge({
      'settings.get': () => ok({ kind: 'ok' as const, snapshot: { settings: done, revision: 0 } }),
      'settings.save': (input) => ok({ settings: input.settings, revision: 1 }),
    });
    renderInShell(<GeneralSection />);
    await user.click(await screen.findByRole('button', { name: 'Run setup again' }));
    expect(screen.getByText('The wizard will show at the next start.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const saved = bridge.calls.find((call) => call.channel === 'settings.save')?.input as
      { settings: Settings } | undefined;
    expect(saved?.settings.general.setupCompletedAt).toBeNull();
  });
});
