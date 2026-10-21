import { defaultSettings, ok } from '@nextlevel/shared';
import { systemCatalog } from '@nextlevel/system-catalog';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../../test-utils.tsx';
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
});
