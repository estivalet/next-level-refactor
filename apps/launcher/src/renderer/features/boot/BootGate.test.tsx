import { defaultSettings, err, ok, type Settings } from '@nextlevel/shared';
import { FakeThemeHost, FIXTURE_MENU } from '@nextlevel/themes/testing';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import i18n from '../../i18n.ts';
import { createQueryClient } from '../../queryClient.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { GeneralSection } from '../settings/GeneralSection.tsx';
import { Desktop } from '../shell/Desktop.tsx';
import { BootGate } from './BootGate.tsx';
import { BootShell } from './BootShell.tsx';
import { listItem } from '../catalog/catalogFixtures.ts';

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

// Setup is done in these tests: the first-run wizard has its own tests below.
const DONE = '2026-10-01T00:00:00.000Z';
const snapshot = (language: 'en' | 'pt-BR' = 'en') => {
  const settings = defaultSettings();
  return {
    settings: { ...settings, general: { ...settings.general, language, setupCompletedAt: DONE } },
    revision: 1,
  };
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
      'settings.get': () => ok({ kind: 'ok' as const, snapshot: snapshot() }),
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

describe('BootGate routing (FR-THM-5, D1)', () => {
  const NO_ART = { packFiles: [], assetsFiles: [], manifest: null, warnings: [] };

  function bootWith(given = defaultSettings(), menu = FIXTURE_MENU) {
    const games = new FakeThemeHost();
    const settings = {
      ...given,
      general: { ...given.general, setupCompletedAt: given.general.setupCompletedAt ?? DONE },
    };
    const bridge = installFakeBridge({
      'settings.get': () => ok({ kind: 'ok', snapshot: { settings, revision: 1 } }),
      'frontend.menu': () => ok(menu),
      'frontend.games': async ({ nodeId }) => ok(await games.getGames(nodeId)),
      'frontend.artIndex': () => ok(NO_ART),
      'frontend.themeOpened': () => ok(undefined),
      'launch.running': () => ok(null),
    });
    render(
      <QueryClientProvider client={createQueryClient()}>
        <BootGate>
          <BootShell initialBounds={{ width: 1200, height: 800 }}>
            <Desktop />
          </BootShell>
        </BootGate>
      </QueryClientProvider>,
    );
    return bridge;
  }

  const target = (bootTarget: Settings['general']['bootTarget']) => {
    const settings = defaultSettings();
    return { ...settings, general: { ...settings.general, bootTarget } };
  };

  it('boots into the last theme (Big Box the first time)', async () => {
    const bridge = bootWith();
    expect(await screen.findByTestId('frontend-layer')).toBeVisible();
    expect(screen.getByTestId('frontend-layer')).toHaveAttribute('data-theme', 'big-box');
    expect(bridge.calls).toContainEqual({
      channel: 'frontend.themeOpened',
      input: { themeId: 'big-box' },
    });
  });

  it('boots to the desktop when the library has no games', async () => {
    bootWith(defaultSettings(), { title: 'NextLevel', items: [] });
    expect(await screen.findByRole('main', { name: 'Desktop' })).toBeVisible();
    expect(screen.queryByTestId('frontend-layer')).toBeNull();
  });

  it('boots to the desktop when that is the boot target', async () => {
    bootWith(target({ kind: 'desktop' }));
    expect(await screen.findByRole('main', { name: 'Desktop' })).toBeVisible();
    expect(screen.queryByTestId('frontend-layer')).toBeNull();
  });

  it('a chosen theme is recorded before the shell shows; an unknown one opens Big Box', async () => {
    const bridge = bootWith(target({ kind: 'theme', themeId: 'retired-theme' }));
    expect(await screen.findByTestId('frontend-layer')).toHaveAttribute('data-theme', 'big-box');
    expect(bridge.calls).toContainEqual({
      channel: 'frontend.themeOpened',
      input: { themeId: 'retired-theme' },
    });
  });

  it('a library that cannot be read boots to the desktop', async () => {
    installFakeBridge({
      'settings.get': () => ok({ kind: 'ok' as const, snapshot: snapshot() }),
      'frontend.menu': () => err('LIBRARY_UNAVAILABLE', 'errors.libraryUnavailable'),
    });
    render(
      <QueryClientProvider client={createQueryClient()}>
        <BootGate>
          <BootShell initialBounds={{ width: 1200, height: 800 }}>
            <Desktop />
          </BootShell>
        </BootGate>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('main', { name: 'Desktop' })).toBeVisible();
    expect(screen.queryByTestId('frontend-layer')).toBeNull();
  });
});

describe('first-run wizard routing (FR-ONB-1, FR-ONB-2, D48)', () => {
  const STARTER = listItem({ starter: true });
  const settingsAt = (setupCompletedAt: string | null): Settings => {
    const settings = defaultSettings();
    return { ...settings, general: { ...settings.general, setupCompletedAt } };
  };

  function boot(setupCompletedAt: string | null) {
    let current = settingsAt(setupCompletedAt);
    let revision = 1;
    installFakeBridge({
      'settings.get': () => ok({ kind: 'ok' as const, snapshot: { settings: current, revision } }),
      'settings.save': (input) => {
        current = input.settings;
        revision += 1;
        return ok({ settings: current, revision });
      },
      'systems.catalog': () => ok([]),
      'systems.list': () => ok([]),
      'catalog.list': (query) =>
        ok({ items: query.starter === 'true' ? [STARTER] : [], nextCursor: null }),
      'catalog.installed': () => ok([]),
      'downloads.list': () => ok([]),
      'launch.running': () => ok(null),
    });
    const client = createQueryClient();
    render(
      <QueryClientProvider client={client}>
        <BootGate>
          <BootShell initialBounds={{ width: 1200, height: 800 }}>
            <Desktop taskbar={null} />
          </BootShell>
        </BootGate>
      </QueryClientProvider>,
    );
  }

  it('an existing install (setup complete) never sees the wizard', async () => {
    boot(DONE);
    expect(await screen.findByRole('navigation', { name: 'Desktop apps' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Choose your systems' })).toBeNull();
  });

  it('FR-ONB-2 / US-B1: a new install sees the wizard; skipping everything lands in the Catalog with the Starter set', async () => {
    const u = userEvent.setup();
    boot(null);
    expect(await screen.findByRole('heading', { name: 'Choose your systems' })).toBeVisible();
    for (let i = 0; i < 4; i += 1) await u.click(screen.getByRole('button', { name: 'Skip' }));
    await u.click(await screen.findByRole('button', { name: 'Browse catalog' }));
    // The window fades in: check what it shows, not its opacity.
    const catalog = await screen.findByRole('dialog', { name: 'Catalog' });
    expect(within(catalog).getByRole('tab', { name: 'Browse' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const starter = await within(catalog).findByRole('list', { name: 'Starter set' });
    expect(within(starter).getByText('Star Hopper')).toBeInTheDocument();
  });

  it('Start after the wizard follows the boot target with the games the wizard found', async () => {
    const u = userEvent.setup();
    const games = new FakeThemeHost();
    let current = settingsAt(null);
    let revision = 1;
    let found = false;
    installFakeBridge({
      'settings.get': () => ok({ kind: 'ok' as const, snapshot: { settings: current, revision } }),
      'settings.save': (input) => {
        current = input.settings;
        revision += 1;
        return ok({ settings: current, revision });
      },
      'systems.catalog': () => ok([]),
      // The library is empty at boot; the wizard's scan finds games.
      'systems.list': () => {
        found = true;
        return ok([{ id: 'nintendo-nes', enabled: true, games: 3, missing: 0, review: 0 }]);
      },
      'frontend.menu': () => ok(found ? FIXTURE_MENU : { title: 'NextLevel', items: [] }),
      'frontend.games': async ({ nodeId }) => ok(await games.getGames(nodeId)),
      'frontend.artIndex': () =>
        ok({ packFiles: [], assetsFiles: [], manifest: null, warnings: [] }),
      'frontend.themeOpened': () => ok(undefined),
      'launch.running': () => ok(null),
    });
    render(
      <QueryClientProvider client={createQueryClient()}>
        <BootGate>
          <BootShell initialBounds={{ width: 1200, height: 800 }}>
            <Desktop />
          </BootShell>
        </BootGate>
      </QueryClientProvider>,
    );
    await screen.findByRole('heading', { name: 'Choose your systems' });
    for (let i = 0; i < 4; i += 1) await u.click(screen.getByRole('button', { name: 'Skip' }));
    await u.click(await screen.findByRole('button', { name: 'Start' }));
    expect(await screen.findByTestId('frontend-layer')).toBeInTheDocument();
  });
});
