import { defaultSettings, ok, type ArtIndex, type Settings } from '@nextlevel/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../../test-utils.tsx';
import { ThemesSection } from '../ThemesSection.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

const INDEX: ArtIndex = {
  packFiles: ['logo/neon/Sega.png'],
  assetsFiles: ['logo/clear/Sega.png', 'logo/steel/Sega.png', 'background/artwork/Sega.jpg'],
  manifest: { id: 'hyperspin', art: { logoVariant: 'neon' }, settings: { filtersInMenu: false } },
  warnings: [],
};

function setup(settings: Settings = defaultSettings(), index: ArtIndex = INDEX) {
  const bridge = installFakeBridge({
    'settings.get': () => ok({ kind: 'ok', snapshot: { settings, revision: 0 } }),
    'settings.save': (input) => ok({ settings: input.settings, revision: 1 }),
    // The pack manifest belongs to its theme only.
    'frontend.artIndex': (input) =>
      ok(input.themeId === index.manifest?.id ? index : { ...index, manifest: null }),
    'systems.catalog': () => ok([]),
  });
  renderInShell(<ThemesSection />);
  return bridge;
}

async function open(name: string) {
  const user = userEvent.setup();
  const card = await screen.findByRole('article', { name });
  await user.click(within(card).getByRole('button', { name: 'Options' }));
  await screen.findByRole('heading', { level: 2, name });
  return user;
}

const saved = (bridge: ReturnType<typeof setup>) =>
  (
    bridge.calls.findLast((call) => call.channel === 'settings.save')?.input as {
      settings: Settings;
    }
  ).settings;

describe('Settings → Themes → a theme’s options (FR-THM-4)', () => {
  it('opens from the theme card and goes back to all themes', async () => {
    setup();
    const user = await open('Big Box');
    await user.click(screen.getByRole('button', { name: 'All themes' }));
    expect(await screen.findByRole('article', { name: 'Big Box' })).toBeVisible();
  });

  it('logo style: suggests the variants found in the art, saves the choice', async () => {
    const bridge = setup();
    const user = await open('Big Box');
    const logo = screen.getByRole('combobox', { name: 'Logo style' });
    expect(logo).toHaveValue('clear');
    const options = [...document.querySelectorAll(`#${logo.getAttribute('list') ?? ''} option`)];
    expect(options.map((o) => o.getAttribute('value'))).toEqual(['clear', 'neon', 'steel']);
    await user.clear(logo);
    await user.type(logo, 'steel');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved(bridge).themes.entries['big-box']).toEqual({ art: { logoVariant: 'steel' } });
  });

  it('shows the pack’s default; Use default drops the user’s value', async () => {
    const settings = defaultSettings();
    settings.themes.entries['hyperspin'] = { art: { logoVariant: 'steel' } };
    const bridge = setup(settings);
    const user = await open('HyperSpin Classic');
    expect(screen.getByRole('combobox', { name: 'Logo style' })).toHaveValue('steel');
    expect(screen.getByText('Pack default: neon')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Use default for Logo style' }));
    expect(screen.getByRole('combobox', { name: 'Logo style' })).toHaveValue('neon');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved(bridge).themes.entries['hyperspin']).toBeUndefined();
  });

  it('video backgrounds and background zoom are switches', async () => {
    const bridge = setup();
    const user = await open('Big Box');
    const video = screen.getByRole('switch', { name: 'Video backgrounds' });
    expect(video).toHaveAttribute('aria-checked', 'true');
    await user.click(video);
    await user.click(screen.getByRole('switch', { name: 'Background zoom' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved(bridge).themes.entries['big-box']?.art).toEqual({
      useVideoBackground: false,
      backgroundZoom: false,
    });
  });

  it('background order: add a found folder, move it up, remove one', async () => {
    const bridge = setup(defaultSettings(), {
      ...INDEX,
      assetsFiles: [...INDEX.assetsFiles, 'background/poster/Sega.jpg'],
    });
    const user = await open('Big Box');
    const list = screen.getByRole('list', { name: 'Backgrounds' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.dataset.value),
    ).toEqual(['background/artwork', 'background/photo']);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Add to Backgrounds' }), [
      'background/poster',
    ]);
    const backgrounds = screen.getByRole('group', { name: 'Backgrounds' });
    await user.click(within(backgrounds).getByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('button', { name: 'Move background/poster up' }));
    await user.click(screen.getByRole('button', { name: 'Remove background/photo' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved(bridge).themes.entries['big-box']?.art?.backgroundVariants).toEqual([
      'background/artwork',
      'background/poster',
    ]);
  });

  it('game background order uses the three sources', async () => {
    const bridge = setup();
    const user = await open('Big Box');
    await user.click(screen.getByRole('button', { name: 'Move Video up' }));
    await user.click(screen.getByRole('button', { name: 'Remove Screenshot' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved(bridge).themes.entries['big-box']?.art?.gameBackgroundSources).toEqual([
      'video',
      'fanart',
    ]);
  });

  it('game art: an order of media kinds for all systems', async () => {
    const bridge = setup();
    const user = await open('Big Box');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Add to Game art' }), [
      'marquee',
    ]);
    const gameArt = screen.getByRole('group', { name: 'Game art' });
    await user.click(within(gameArt).getByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved(bridge).themes.entries['big-box']?.art?.gameArt?.['default']?.at(-1)).toBe(
      'marquee',
    );
  });

  it('filters in the menu only for HyperSpin and Showcase', async () => {
    setup();
    let user = await open('Big Box');
    expect(screen.queryByRole('switch', { name: 'Filters in the menu' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'All themes' }));
    user = await open('Showcase');
    expect(screen.getByRole('switch', { name: 'Filters in the menu' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('HyperSpin wheel: an out-of-range value shows the range and blocks Save', async () => {
    const bridge = setup();
    await open('HyperSpin Classic');
    const wheel = screen.getByRole('group', { name: 'Game list wheel' });
    const height = within(wheel).getByRole('spinbutton', { name: 'Item height' });
    expect(height).toHaveAttribute('placeholder', '96');
    fireEvent.change(height, { target: { value: '9000' } });
    expect(within(wheel).getByRole('alert')).toHaveTextContent('24–400');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.change(height, { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('heading', { level: 2, name: 'HyperSpin Classic' });
    expect(saved(bridge).themes.entries['hyperspin']?.settings).toEqual({
      wheel: { itemHeight: 120 },
    });
  });

  it('Reset to defaults clears every option of the theme', async () => {
    const settings = defaultSettings();
    settings.themes.entries['ps5'] = { art: { logoVariant: 'x', backgroundZoom: false } };
    const bridge = setup(settings);
    const user = await open('PS5 Style');
    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved(bridge).themes.entries['ps5']).toBeUndefined();
  });
});
