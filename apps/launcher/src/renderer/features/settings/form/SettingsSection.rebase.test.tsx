import { SettingsSchema, defaultSettings, ok, type Settings } from '@nextlevel/shared';
import { systemCatalog } from '@nextlevel/system-catalog';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../../test-utils.tsx';
import { StorageSection } from '../StorageSection.tsx';
import { SystemsSection } from '../systems/SystemsSection.tsx';

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(480);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640);
});
afterEach(() => {
  setBridgeForTests(null);
  vi.restoreAllMocks();
});

describe('settings drafts', () => {
  it('FR-SET-2: a newer snapshot keeps an unsaved Systems edit', async () => {
    const user = userEvent.setup();
    const bridge = installFakeBridge({
      'systems.catalog': () => ok([...systemCatalog()]),
      'settings.get': () =>
        ok({ kind: 'ok' as const, snapshot: { settings: defaultSettings(), revision: 0 } }),
    });
    renderInShell(<SystemsSection />);
    await user.type(await screen.findByRole('searchbox', { name: 'Search systems' }), 'saturn');
    await user.click(screen.getByRole('switch', { name: 'Enable Sega Saturn' }));

    // The scan enabled another system meanwhile.
    bridge.emit('settings.changed', {
      settings: { ...defaultSettings(), systems: { 'nintendo-64': { enabled: true } } },
      revision: 1,
    });

    expect(await screen.findByText('2 of 438 enabled')).toBeVisible();
    expect(screen.getByRole('switch', { name: 'Enable Sega Saturn' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  it('FR-SET-2: saving a value the schema trims leaves nothing unsaved', async () => {
    const user = userEvent.setup();
    const location = {
      id: '0192b2a0-0000-7000-8000-000000000001',
      name: 'Retro',
      path: 'E:/roms',
      priority: 1,
    };
    const settings: Settings = {
      ...defaultSettings(),
      storage: { ...defaultSettings().storage, locations: [location] },
    };
    let revision = 0;
    installFakeBridge({
      'settings.get': () => ok({ kind: 'ok' as const, snapshot: { settings, revision: 0 } }),
      'scan.status': () => ok({ running: false, progress: null, last: null }),
      // Main validates with the shared schema, which trims names.
      'settings.save': (input) =>
        ok({ settings: SettingsSchema.parse(input.settings), revision: (revision += 1) }),
    });
    renderInShell(<StorageSection />);
    await user.type(await screen.findByRole('textbox', { name: 'Name of location 1' }), ' ');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await expect.poll(() => screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Name of location 1' })).toHaveValue('Retro');
  });
});
