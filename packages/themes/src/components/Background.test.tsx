// Cases ported from NextLevelOS src/themes/components/Background.test.tsx @ 3d530b7 (the legacy
// candidate props are gone: callers pass layers).
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ART_CONFIG, NO_ART, ThemeArtContext } from '../engine/useThemeArt.ts';
import { Background } from './Background.tsx';
import { CascadingImage } from './CascadingImage.tsx';
import { LevelLogo } from './LevelLogo.tsx';

describe('Background (FR-THM-2)', () => {
  it('renders overlay content', () => {
    render(<Background layers={[]} overlay={<div data-testid="ov">grad</div>} />);
    expect(screen.getByTestId('ov')).toBeInTheDocument();
  });

  it('stacks layers with the first source painted on top', () => {
    const { container } = render(
      <Background
        layers={[
          { kind: 'image', candidates: ['fan.jpg'] },
          { kind: 'video', candidates: ['clip.mp4'] },
          { kind: 'image', candidates: ['shot.png'] },
        ]}
      />,
    );
    const media = [...container.querySelectorAll('img, video')];
    expect(media.map((el) => el.getAttribute('src'))).toEqual(['shot.png', 'clip.mp4', 'fan.jpg']);
    expect(media.every((el) => !(el.parentElement as HTMLElement).style.zIndex)).toBe(true);
  });

  it('drops empty layers', () => {
    const { container } = render(
      <Background
        layers={[
          { kind: 'image', candidates: [] },
          { kind: 'image', candidates: ['only.jpg'] },
        ]}
      />,
    );
    expect([...container.querySelectorAll('img')].map((i) => i.getAttribute('src'))).toEqual([
      'only.jpg',
    ]);
  });

  it('unmounts lower layers once a higher one has loaded', () => {
    const { container } = render(
      <Background
        layers={[
          { kind: 'image', candidates: ['fan.jpg'] },
          { kind: 'video', candidates: ['clip.mp4'] },
        ]}
      />,
    );
    fireEvent.load(container.querySelector('img') as HTMLImageElement);
    expect(container.querySelector('video')).toBeNull();
  });
});

describe('Background while inactive (FR-THM-1)', () => {
  it('drops video layers while paused and keeps the stills', () => {
    const { container } = render(
      <Background
        paused
        layers={[
          { kind: 'video', candidates: ['clip.mp4'] },
          { kind: 'image', candidates: ['still.jpg'] },
        ]}
      />,
    );
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('img')).toHaveAttribute('src', 'still.jpg');
  });
});

describe('Background zoom (FR-THM-4)', () => {
  const layers = [
    { kind: 'image' as const, candidates: ['still.jpg'] },
    { kind: 'video' as const, candidates: ['clip.mp4'] },
  ];

  it('slowly zooms still images, not videos, by default', () => {
    const { container } = render(<Background layers={layers} />);
    expect(container.querySelector('img')).toHaveClass('nl-bg-zoom');
    expect(container.querySelector('video')).not.toHaveClass('nl-bg-zoom');
  });

  it('is off when the theme sets art.backgroundZoom to false', () => {
    const { container } = render(
      <ThemeArtContext.Provider
        value={{ ...NO_ART, config: { ...DEFAULT_ART_CONFIG, backgroundZoom: false } }}
      >
        <Background layers={layers} />
      </ThemeArtContext.Provider>,
    );
    expect(container.querySelector('img')).not.toHaveClass('nl-bg-zoom');
  });

  it('the zoom prop overrides the theme setting', () => {
    const { container } = render(<Background layers={layers} zoom={false} />);
    expect(container.querySelector('img')).not.toHaveClass('nl-bg-zoom');
  });
});

describe('CascadingImage and LevelLogo (FR-THM-2)', () => {
  it('falls through to the next candidate when one fails', () => {
    const { container } = render(<CascadingImage srcs={['a.png', 'b.png']} alt="" />);
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    expect(container.querySelector('img')).toHaveAttribute('src', 'b.png');
  });

  it('shows the fallback once every candidate failed', () => {
    const { container } = render(
      <CascadingImage srcs={['a.png']} alt="" fallback={<span>none</span>} />,
    );
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    expect(screen.getByText('none')).toBeInTheDocument();
  });

  it('starts over when the candidates change', () => {
    const { container, rerender } = render(<CascadingImage srcs={['a.png', 'b.png']} alt="" />);
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    rerender(<CascadingImage srcs={['c.png', 'd.png']} alt="" />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'c.png');
  });

  it('LevelLogo falls back to text when there are no candidates', () => {
    render(<LevelLogo candidates={[]} fallbackText="ATARI 2600" />);
    expect(screen.getByText('ATARI 2600')).toBeInTheDocument();
  });
});
