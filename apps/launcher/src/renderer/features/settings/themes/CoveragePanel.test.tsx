import { ok, type ArtIndex, type MenuTree } from '@nextlevel/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../../test-utils.tsx';
import { resetThemeArtSession } from '../../frontend/themeArtSession.ts';
import { ThemesSection } from '../ThemesSection.tsx';

afterEach(() => {
  setBridgeForTests(null);
  resetThemeArtSession();
});

const MENU: MenuTree = {
  title: 'NextLevel',
  items: [
    {
      id: 'm:sega',
      name: 'Sega',
      display: 'Sega',
      type: 'category',
      children: [
        {
          id: 's:genesis',
          name: 'Genesis',
          display: 'Genesis',
          type: 'system',
          systemId: 'genesis',
          children: [],
        },
      ],
    },
  ],
};

const NO_PACK: ArtIndex = { packFiles: [], assetsFiles: [], manifest: null, warnings: [] };
// Big Box counts logo, background and video: 2 + 1 + 0 of 6.
const PACK: ArtIndex = {
  packFiles: ['logo/clear/Sega.png', 'logo/clear/Genesis.png', 'background/artwork/Sega.jpg'],
  assetsFiles: [],
  manifest: { id: 'big-box', version: '1.2', author: 'Ana' },
  warnings: [{ code: 'manifestArtWrongType', field: 'logoVariant' }, { code: 'folderUnreadable' }],
};

function setup(index: (input: { themeId: string; refresh?: boolean | undefined }) => ArtIndex) {
  const bridge = installFakeBridge({
    'frontend.menu': () => ok(MENU),
    'frontend.artIndex': (input) => ok(index(input)),
  });
  renderInShell(<ThemesSection />);
  return bridge;
}

const card = (name: string) => screen.findByRole('article', { name });

describe('Settings → Themes → pack coverage (FR-THM-2)', () => {
  it('each card shows No pack, or the share of menu art its pack covers', async () => {
    setup(({ themeId }) => (themeId === 'big-box' ? PACK : NO_PACK));
    expect(
      await within(await card('Big Box')).findByRole('button', { name: 'Art 50%' }),
    ).toBeVisible();
    expect(
      await within(await card('PS5 Style')).findByRole('button', { name: 'No pack' }),
    ).toBeVisible();
  });

  it('the panel lists slots, missing items, the pack details and its warnings', async () => {
    const user = userEvent.setup();
    setup(() => PACK);
    await user.click(await within(await card('Big Box')).findByRole('button', { name: 'Art 50%' }));
    const panel = screen.getByRole('dialog', { name: 'Art coverage: Big Box' });
    expect(within(panel).getByText('v1.2 · Ana')).toBeVisible();
    expect(within(panel).getByText('Logo 2 / 2')).toBeVisible();
    expect(within(panel).getByText('Background 1 / 2')).toBeVisible();
    expect(within(panel).getAllByText('Genesis').length).toBeGreaterThan(0);
    expect(within(panel).getByText('Video 0 / 2')).toBeVisible();
    expect(
      within(panel).getByText('theme.json: art.logoVariant has the wrong type and is ignored.'),
    ).toBeVisible();
    expect(within(panel).getByText('An art folder is missing or can’t be read.')).toBeVisible();
    await user.click(within(panel).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('without a pack the panel says the shared art folder is used', async () => {
    const user = userEvent.setup();
    setup(() => NO_PACK);
    await user.click(await within(await card('Big Box')).findByRole('button', { name: 'No pack' }));
    expect(
      screen.getByText('No theme pack folder found. All art comes from the shared art folder.'),
    ).toBeVisible();
  });

  it('Preview without fallback is kept for the session, not saved', async () => {
    const user = userEvent.setup();
    const bridge = setup(() => PACK);
    const open = async () => {
      await user.click(
        await within(await card('Big Box')).findByRole('button', { name: 'Art 50%' }),
      );
      return screen.getByRole('checkbox', { name: 'Preview without fallback' });
    };
    const preview = await open();
    expect(preview).not.toBeChecked();
    await user.click(preview);
    await user.keyboard('{Escape}');
    expect(await open()).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(bridge.channels()).not.toContain('settings.save');
  });

  it('Rescan art reads the folders again', async () => {
    const user = userEvent.setup();
    let index = NO_PACK;
    const bridge = setup(() => index);
    await user.click(await within(await card('Big Box')).findByRole('button', { name: 'No pack' }));
    index = PACK;
    await user.click(screen.getByRole('button', { name: 'Rescan art' }));
    expect(bridge.calls).toContainEqual({
      channel: 'frontend.artIndex',
      input: { themeId: 'big-box', refresh: true },
    });
    await waitFor(() => {
      expect(screen.getByText('Logo 2 / 2')).toBeVisible();
    });
  });
});
