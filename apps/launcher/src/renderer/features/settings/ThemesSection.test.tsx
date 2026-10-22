import { defaultSettings, ok, type Settings } from '@nextlevel/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { ThemesSection } from './ThemesSection.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

describe('Settings → Themes (FR-THM-1, FR-THM-5)', () => {
  it('lists the bundled themes and marks the one the front-end opens', async () => {
    installFakeBridge();
    renderInShell(<ThemesSection />);
    const card = await screen.findByRole('article', { name: 'Big Box' });
    expect(within(card).getByText('Fullscreen carousel of menu logos and box art')).toBeVisible();
    expect(within(card).getByText('In use')).toBeVisible();
  });

  it('choosing a theme makes it the default and the one the front-end opens', async () => {
    const user = userEvent.setup();
    const settings = defaultSettings();
    const bridge = installFakeBridge({
      'settings.get': () =>
        ok({
          kind: 'ok',
          snapshot: {
            settings: { ...settings, themes: { ...settings.themes, lastUsed: 'retired' } },
            revision: 0,
          },
        }),
      'settings.save': (input) => ok({ settings: input.settings, revision: 1 }),
    });
    renderInShell(<ThemesSection />);
    const card = await screen.findByRole('article', { name: 'Big Box' });
    await user.click(within(card).getByRole('button', { name: 'Use this theme' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const saved = bridge.calls.find((call) => call.channel === 'settings.save');
    expect((saved?.input as { settings: Settings }).settings.themes).toMatchObject({
      activeDefault: 'big-box',
      lastUsed: 'big-box',
    });
  });
});
