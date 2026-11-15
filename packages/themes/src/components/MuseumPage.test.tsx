// FR-MUS-4, FR-MUS-5: the museum page a theme opens for a system, driven by controller input.
import { defaultSettings, remoteImageUrl, type ThemeSystemInfo } from '@nextlevel/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeEngineProvider } from '../engine/ThemeEngineProvider.tsx';
import { FakeThemeHost } from '../host/FakeThemeHost.ts';
import { MuseumPage } from './MuseumPage.tsx';

const input = defaultSettings().input;

function press(target: Element, code: string) {
  fireEvent.keyDown(target, { code });
  fireEvent.keyUp(target, { code });
}

const entry = (over: Partial<ThemeSystemInfo> = {}): ThemeSystemInfo => ({
  systemId: 'nes',
  models: [],
  peripherals: [],
  topGames: [],
  sources: [],
  ...over,
});

function setup(
  info: ThemeSystemInfo,
  props: { onClose?: () => void; onLaunch?: (id: number) => void } = {},
) {
  const host = new FakeThemeHost({ systemInfo: { [info.systemId]: info } });
  const onClose = props.onClose ?? vi.fn();
  const onLaunch = props.onLaunch ?? vi.fn();
  render(
    <ThemeEngineProvider host={host} onExit={vi.fn()}>
      <MuseumPage
        open
        systemId={info.systemId}
        title="Nintendo Entertainment System"
        logoCandidates={[]}
        input={input}
        onClose={onClose}
        onLaunch={onLaunch}
      />
    </ThemeEngineProvider>,
  );
  return { onClose, onLaunch };
}

describe('MuseumPage', () => {
  it('FR-MUS-4: shows manufacturer · year · country and the description', async () => {
    setup(
      entry({
        manufacturer: 'Nintendo',
        releaseYear: 1983,
        country: 'Japan',
        description: 'An 8-bit console.',
      }),
    );
    expect(
      await screen.findByText('Nintendo · 1983 · Japan', {}, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('An 8-bit console.')).toBeInTheDocument();
  });

  it('FR-MUS-4: an empty entry shows the title and the empty message', async () => {
    setup(entry());
    expect(
      await screen.findByText('No museum entry for this system yet.', {}, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Nintendo Entertainment System').length).toBeGreaterThan(0);
  });

  it('FR-MUS-4: select on an owned top game launches it; unowned games are not focusable', async () => {
    const { onLaunch } = setup(
      entry({
        description: 'x',
        topGames: [
          { title: 'Missing Game', owned: null },
          { title: 'Owned Game', year: 1985, owned: { gameId: 7 } },
        ],
      }),
    );
    const owned = await screen.findByRole('button', { name: /Owned Game/ }, { timeout: 2000 });
    expect(screen.queryByRole('button', { name: /Missing Game/ })).toBeNull();
    expect(screen.getByText(/Missing Game/)).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    press(dialog, 'ArrowDown');
    expect(document.activeElement).toBe(owned);
    press(dialog, 'Enter');
    expect(onLaunch).toHaveBeenCalledWith(7);
  });

  it('FR-MUS-4: back closes the page', async () => {
    const { onClose } = setup(entry({ description: 'x' }));
    await screen.findByText('x', {}, { timeout: 2000 });
    press(screen.getByRole('dialog'), 'Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('FR-MUS-5, FR-SET-6: shows source names as plain text, never links that leave kiosk', async () => {
    setup(
      entry({
        description: 'x',
        sources: [
          { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/NES' },
          { name: 'Old page', url: 'http://example.com/a' },
          { name: 'Book' },
        ],
      }),
    );
    expect(await screen.findByText('Wikipedia', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
    expect(document.querySelector('.museum-sources a')).toBeNull();
    expect(screen.getByText('Old page')).toBeInTheDocument();
    expect(screen.getByText('Book')).toBeInTheDocument();
  });

  it('FR-MUS-4: model images load through nextlevel://remote-image; a broken one becomes a placeholder', async () => {
    setup(
      entry({
        models: [
          {
            name: 'Famicom',
            releaseYear: 1983,
            launchPrice: '¥14,800',
            imageUrl: 'https://example.com/f.png',
          },
          { name: 'Plain' },
        ],
      }),
    );
    const img = await screen.findByRole('img', { name: 'Famicom' }, { timeout: 2000 });
    expect(img).toHaveAttribute('src', remoteImageUrl('https://example.com/f.png'));
    expect(img.getAttribute('src')).toMatch(/^nextlevel:\/\/remote-image\//);
    fireEvent.error(img);
    expect(screen.queryByRole('img', { name: 'Famicom' })).toBeNull();
    expect(screen.getAllByText('No image')).toHaveLength(2);
    expect(screen.getByText('Launch price: ¥14,800')).toBeInTheDocument();
  });
});
