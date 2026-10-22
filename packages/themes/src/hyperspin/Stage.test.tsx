// Cases ported from NextLevelOS src/themes/hyperspin/Stage.test.tsx @ 3d530b7.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Stage, type StageItem } from './Stage.tsx';

const item = (over: Partial<StageItem> = {}): StageItem => ({
  key: '2:901',
  title: 'Alpha',
  logo: [],
  frameVideo: [],
  frameImage: [],
  box: null,
  ...over,
});

const base = { countText: '', flash: null, message: null, trail: '' };

describe('HyperSpin stage (FR-THM-1)', () => {
  it('shows the logo fallback text and the count', () => {
    render(<Stage {...base} item={item()} countText="2 games" />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('2 games')).toBeInTheDocument();
  });

  it('shows box art only for games (box not null)', () => {
    const { container, rerender } = render(<Stage {...base} item={item()} />);
    expect(container.querySelector('.hs-box-layer')).toBeNull();
    rerender(<Stage {...base} item={item({ box: ['box.png'] })} />);
    expect(container.querySelector('.hs-box-layer img')?.getAttribute('src')).toBe('box.png');
  });

  it('the frame plays the video and falls back to the image on error', () => {
    const { container } = render(
      <Stage {...base} item={item({ frameVideo: ['v.mp4'], frameImage: ['shot.png'] })} />,
    );
    const video = container.querySelector('.hs-frame-layer video');
    expect(video?.getAttribute('src')).toBe('v.mp4');
    if (video) fireEvent.error(video);
    expect(container.querySelector('.hs-frame-layer video')).toBeNull();
    expect(container.querySelector('.hs-frame-layer img')?.getAttribute('src')).toBe('shot.png');
  });

  it('a message replaces the item', () => {
    render(<Stage {...base} item={item()} message="No games" />);
    expect(screen.getByText('No games')).toBeInTheDocument();
    expect(screen.queryByText('Alpha')).toBeNull();
  });

  it('changing only countText keeps one count layer with the same play key', () => {
    const { container, rerender } = render(<Stage {...base} item={item()} countText="…" />);
    const key = container.querySelector('.hs-count-layer')?.getAttribute('data-play-key');
    rerender(<Stage {...base} item={item()} countText="3 games" />);
    const layers = container.querySelectorAll('.hs-count-layer');
    expect(layers).toHaveLength(1);
    expect(layers[0]?.getAttribute('data-play-key')).toBe(key);
    expect(layers[0]?.textContent).toBe('3 games');
  });

  it('shows the letter flash and the trail', () => {
    const { container } = render(
      <Stage {...base} item={item()} flash={{ letter: 'B', id: 1 }} trail="Sega › Sega Genesis" />,
    );
    expect(container.querySelector('.hs-letter')?.textContent).toBe('B');
    expect(screen.getByText('Sega › Sega Genesis')).toBeInTheDocument();
  });
});
