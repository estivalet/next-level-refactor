import { defaultSettings, err, ok } from '@nextlevel/shared';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import i18n from '../../i18n.ts';
import { createQueryClient } from '../../queryClient.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { GeneralSection } from '../settings/GeneralSection.tsx';
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

describe('BootGate after boot', () => {
  it('NFR-I18N-1: saving a new language switches the UI without remounting the shell', async () => {
    const user = userEvent.setup();
    let mounts = 0;
    function MountProbe() {
      useEffect(() => {
        mounts += 1;
      }, []);
      return null;
    }
    installFakeBridge({
      'settings.save': (input) => ok({ settings: input.settings, revision: 1 }),
    });
    renderInShell(
      <BootGate>
        <MountProbe />
        <GeneralSection />
      </BootGate>,
    );
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Language' }), 'pt-BR');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('combobox', { name: 'Idioma' })).toHaveValue('pt-BR');
    expect(mounts).toBe(1);
  });
});

describe('BootGate review fixes', () => {
  it('US-D3: a failed restore on the recovery screen says why', async () => {
    const user = userEvent.setup();
    installFakeBridge({
      'settings.get': invalid('settings-1.json'),
      'settings.backups.restore': () => err('INVALID_SETTINGS', 'errors.invalidSettings'),
    });
    renderInShell(
      <BootGate>
        <DesktopProbe />
      </BootGate>,
    );
    await user.click(await screen.findByRole('button', { name: 'Restore latest backup' }));
    expect(
      await screen.findByText('Those settings are not valid and were not applied.'),
    ).toBeVisible();
  });

  it('a failed background refresh keeps the shell open', async () => {
    let fail = false;
    installFakeBridge({
      'settings.get': () =>
        fail
          ? Promise.reject(new Error('ipc down'))
          : ok({ kind: 'ok' as const, snapshot: snapshot() }),
    });
    const client = createQueryClient();
    render(
      <QueryClientProvider client={client}>
        <BootGate>
          <DesktopProbe />
        </BootGate>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Desktop apps')).toBeVisible();
    fail = true;
    await act(() => client.refetchQueries({ queryKey: ['settings'] }));
    await vi.waitFor(() => {
      expect(client.getQueryState(['settings'])?.status).toBe('error');
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Desktop apps')).toBeVisible();
  });
});
