// Cases ported from NextLevelOS src/themes/components/AnimatedLayer.test.tsx @ 3d530b7.
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimatedLayer } from './AnimatedLayer.tsx';

const reduced = vi.hoisted(() => ({ value: false }));
vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const entranceOf = (container: HTMLElement, key: string) =>
  container.querySelector(`[data-play-key="${key}"]`)?.getAttribute('data-entrance');

afterEach(() => {
  reduced.value = false;
  vi.restoreAllMocks();
});

describe('AnimatedLayer (FR-THM-1)', () => {
  it('picks an entrance from the pool and keeps it across rerenders', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const { container, rerender } = render(
      <AnimatedLayer playKey="a" pool={['drop', 'spin-in']}>
        <span>A</span>
      </AnimatedLayer>,
    );
    expect(entranceOf(container, 'a')).toBe('spin-in');
    vi.spyOn(Math, 'random').mockReturnValue(0);
    rerender(
      <AnimatedLayer playKey="a" pool={['drop', 'spin-in']}>
        <span>A!</span>
      </AnimatedLayer>,
    );
    expect(entranceOf(container, 'a')).toBe('spin-in');
  });

  it('a new playKey replays with a new pick', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const { container, rerender } = render(
      <AnimatedLayer playKey="a" pool={['drop', 'spin-in']}>
        <span>A</span>
      </AnimatedLayer>,
    );
    vi.spyOn(Math, 'random').mockReturnValue(0);
    rerender(
      <AnimatedLayer playKey="b" pool={['drop', 'spin-in']}>
        <span>B</span>
      </AnimatedLayer>,
    );
    expect(entranceOf(container, 'b')).toBe('drop');
  });

  it('a null playKey renders no content (the previous content exits)', async () => {
    const { container, rerender } = render(
      <AnimatedLayer playKey="a" pool={['drop']}>
        <span>A</span>
      </AnimatedLayer>,
    );
    expect(container.querySelector('[data-play-key="a"]')).not.toBeNull();
    rerender(
      <AnimatedLayer playKey={null} pool={['drop']}>
        <span>A</span>
      </AnimatedLayer>,
    );
    await waitFor(() => {
      expect(container.querySelector('[data-play-key]')).toBeNull();
    });
  });

  it('fades when the OS asks for reduced motion', () => {
    reduced.value = true;
    const { container } = render(
      <AnimatedLayer playKey="a" pool={['zoom-rotate']}>
        <span>A</span>
      </AnimatedLayer>,
    );
    expect(entranceOf(container, 'a')).toBe('fade');
  });
});
