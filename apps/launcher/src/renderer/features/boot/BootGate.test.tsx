import { defaultSettings, ok } from '@nextlevel/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTranslation } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import i18n from '../../i18n.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { BootGate } from './BootGate.tsx';

// changeLanguage is async; a switch started by one test can land after the previous reset.
beforeEach(async () => {
  await i18n.changeLanguage('en');
});

afterEach(async () => {
  setBridgeForTests(null);
  await i18n.changeLanguage('en');
});

function DesktopProbe() {
  const { t } = useTranslation();
  return <p>{t('shell.desktop.apps')}</p>;
}

const snapshot = (language: 'en' | 'pt-BR' = 'en') => {
  const settings = defaultSettings();
  return { settings: { ...settings, general: { ...settings.general, language } }, revision: 1 };
};

const invalid = (latestBackupId: string | null) => () =>
  ok({ kind: 'invalid' as const, reason: 'unreadable' as const, latestBackupId });

describe('BootGate', () => {
  it('FR-SET-2: an invalid settings file shows recovery instead of the desktop', async () => {
    installFakeBridge({ 'settings.get': invalid('settings-1.json') });
    renderInShell(
      <BootGate>
        <DesktopProbe />
      </BootGate>,
    );
    expect(
      await screen.findByRole('heading', { name: 'Settings could not be loaded' }),
    ).toBeVisible();
    expect(screen.queryByText('Desktop apps')).not.toBeInTheDocument();
  });

  it('US-D3: Restore latest backup restores the latest id and then shows the desktop', async () => {
    const user = userEvent.setup();
    const bridge = installFakeBridge({
      'settings.get': invalid('settings-1.json'),
      'settings.backups.restore': () => ok(snapshot()),
    });
    renderInShell(
      <BootGate>
        <DesktopProbe />
      </BootGate>,
    );
    await user.click(await screen.findByRole('button', { name: 'Restore latest backup' }));
    expect(await screen.findByText('Desktop apps')).toBeVisible();
    expect(bridge.calls).toContainEqual({
      channel: 'settings.backups.restore',
      input: { id: 'settings-1.json' },
    });
  });

  it('Restore latest backup is disabled when there is no backup', async () => {
    installFakeBridge({ 'settings.get': invalid(null) });
    renderInShell(
      <BootGate>
        <DesktopProbe />
      </BootGate>,
    );
    expect(await screen.findByRole('button', { name: 'Restore latest backup' })).toBeDisabled();
  });

  it('Reset to defaults calls settings.reset and shows the desktop', async () => {
    const user = userEvent.setup();
    const bridge = installFakeBridge({
      'settings.get': invalid(null),
      'settings.reset': () => ok(snapshot()),
    });
    renderInShell(
      <BootGate>
        <DesktopProbe />
      </BootGate>,
    );
    await user.click(await screen.findByRole('button', { name: 'Reset to defaults' }));
    expect(await screen.findByText('Desktop apps')).toBeVisible();
    expect(bridge.channels()).toContain('settings.reset');
  });

  it('NFR-I18N-1: language pt-BR switches the UI and html lang', async () => {
    installFakeBridge({
      'settings.get': () => ok({ kind: 'ok' as const, snapshot: snapshot('pt-BR') }),
    });
    renderInShell(
      <BootGate>
        <DesktopProbe />
      </BootGate>,
    );
    expect(await screen.findByText('Aplicativos da área de trabalho')).toBeVisible();
    expect(document.documentElement.lang).toBe('pt-BR');
  });
});

describe('BootGate when the settings service is unreachable', () => {
  it('says the service is unavailable rather than that the file is damaged', async () => {
    installFakeBridge({ 'settings.get': () => Promise.reject(new Error('no bridge')) });
    renderInShell(
      <BootGate>
        <DesktopProbe />
      </BootGate>,
    );
    expect(await screen.findByText(/could not reach its settings service/)).toBeVisible();
    expect(screen.queryByText(/damaged/)).not.toBeInTheDocument();
  });
});
