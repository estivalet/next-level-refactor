// Cases ported from NextLevelOS src/themes/hyperspin/HyperspinTheme.test.tsx @ 3d530b7 (wheel
// settings, pointer art, filtersInMenu). Pointer art comes from the art index, so nothing probes
// images.
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { press } from '../themeTestUtils.tsx';
import {
  atRoot,
  filterLabel,
  filterPos,
  focusedLabel,
  focusedSlotHeight,
  mountHyperspin,
  openSolo,
  pointerFor,
} from './testUtils.tsx';

const art = (files: string[]) => ({
  packFiles: [],
  assetsFiles: files,
  manifest: null,
  warnings: [],
});
const pointerSrc = (name: string) =>
  decodeURIComponent(pointerFor(name)?.querySelector('img')?.getAttribute('src') ?? '');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HyperSpin pointer (FR-THM-1, FR-THM-2)', () => {
  it('follows the focused menu item, then falls back to _default', async () => {
    mountHyperspin({ art: art(['pointer/_default.png', 'pointer/Sega.png']) });
    await atRoot();
    await waitFor(() => {
      expect(pointerSrc('Nintendo')).toMatch(/pointer\/_default\.png$/);
    });
    press('ArrowDown');
    await waitFor(() => {
      expect(pointerSrc('Sega')).toMatch(/pointer\/Sega\.png$/);
    });
  });

  it('does not blink when the next item has the same pointer art', async () => {
    mountHyperspin({ art: art(['pointer/_default.png']) });
    await atRoot();
    await waitFor(() => {
      expect(pointerSrc('Nintendo')).not.toBe('');
    });
    const before = document.querySelector('[data-pointer]');
    press('ArrowDown');
    await waitFor(() => {
      expect(pointerFor('Sega')).not.toBeNull();
    });
    expect(document.querySelectorAll('[data-pointer]')).toHaveLength(1);
    expect(document.querySelector('[data-pointer]')).toBe(before);
  });

  it('shows the built-in knob without pointer art, on menus and game lists', async () => {
    mountHyperspin();
    await atRoot();
    expect(pointerFor('Nintendo')?.querySelector('.hs-pointer')).not.toBeNull();
    await openSolo();
    expect(pointerFor('Solo')?.querySelector('.hs-pointer')).not.toBeNull();
  });

  it('on a game list the pointer is the system and stays while games scroll', async () => {
    mountHyperspin();
    await openSolo();
    press('ArrowDown');
    expect(focusedLabel()).toBe('Alpha');
    expect(pointerFor('Solo')).not.toBeNull();
    expect(pointerFor('Alpha')).toBeNull();
  });
});

describe('HyperSpin wheel settings (FR-THM-4)', () => {
  it('applies settings.wheel: width, padding, item height and pointer height', async () => {
    mountHyperspin({
      settings: {
        wheel: { width: '40%', itemHeight: 80, padding: [0, 10, 0, 10], pointerHeight: 300 },
      },
    });
    await atRoot();
    const root = document.querySelector<HTMLElement>('.hs-root');
    expect(root?.style.getPropertyValue('--hs-wheel-width')).toBe('40%');
    expect(root?.style.getPropertyValue('--hs-item-padding')).toBe('0px 10px 0px 10px');
    expect(focusedSlotHeight()).toBe('80px');
    expect(pointerFor('Nintendo')?.style.getPropertyValue('--hs-pointer-height')).toBe('300px');
  });

  it('invalid wheel settings fall back to the defaults with one warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mountHyperspin({ settings: { wheel: { itemHeight: '90', bogus: 1 } } });
    await atRoot();
    expect(focusedSlotHeight()).toBe('96px');
    press('ArrowDown');
    press('ArrowUp');
    const calls = warn.mock.calls.filter((call) => String(call[0]).includes('hyperspin'));
    expect(calls).toHaveLength(1);
    expect(String(calls[0]?.[0])).toContain('itemHeight');
  });

  it('menu levels use menuWheel over wheel; game lists use wheel', async () => {
    mountHyperspin({ settings: { wheel: { itemHeight: 80 }, menuWheel: { itemHeight: 170 } } });
    await atRoot();
    expect(focusedSlotHeight()).toBe('170px');
    await openSolo();
    expect(focusedSlotHeight()).toBe('80px');
  });

  it('menu levels inherit the wheel keys menuWheel leaves out', async () => {
    mountHyperspin({
      settings: { wheel: { itemHeight: 80, width: '40%' }, menuWheel: { spacing: 0.8 } },
    });
    await atRoot();
    expect(focusedSlotHeight()).toBe('80px');
    expect(
      document.querySelector<HTMLElement>('.hs-root')?.style.getPropertyValue('--hs-wheel-width'),
    ).toBe('40%');
  });
});

describe('HyperSpin filtersInMenu (FR-THM-4)', () => {
  async function toSnes() {
    await atRoot();
    press('Enter');
    await waitFor(() => {
      expect(focusedLabel()).toBe('Super Nintendo');
    });
  }

  it('default (true): a system with filters opens its filter menu', async () => {
    mountHyperspin();
    await toSnes();
    press('Enter');
    await waitFor(() => {
      expect(focusedLabel()).toBe('Official');
    });
  });

  it('false: a system with filters opens its games on Official; the pill cycles; back returns', async () => {
    mountHyperspin({ settings: { filtersInMenu: false } });
    await toSnes();
    await screen.findByText('10 games');
    press('Enter');
    await waitFor(() => {
      expect(focusedLabel()).toBe('Snes A');
    });
    expect(filterLabel()).toBe('Official');
    expect(filterPos()).toBe('1/4');
    press('KeyE');
    expect(filterLabel()).toBe('Homebrew');
    expect(filterPos()).toBe('2/4');
    fireEvent.click(screen.getByLabelText('Previous filter'));
    fireEvent.click(screen.getByLabelText('Previous filter'));
    expect(filterLabel()).toBe('Hidden');
    expect(filterPos()).toBe('4/4');
    fireEvent.click(screen.getByLabelText('Next filter'));
    expect(filterLabel()).toBe('Official');
    press('Escape');
    await waitFor(() => {
      expect(focusedLabel()).toBe('Super Nintendo');
    });
  });

  it('false: a system without filters opens with the default tabs', async () => {
    mountHyperspin({ settings: { filtersInMenu: false } });
    await toSnes();
    press('ArrowDown');
    press('Enter');
    await waitFor(() => {
      expect(focusedLabel()).toBe('N64 A');
    });
    expect(filterLabel()).toBe('All');
    expect(filterPos()).toBe('1/3');
  });

  it('a wrong filtersInMenu type warns once, not on every render', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mountHyperspin({ settings: { filtersInMenu: 'no' } });
    await toSnes();
    press('ArrowDown');
    press('ArrowUp');
    const calls = warn.mock.calls.filter((call) => String(call[0]).includes('filtersInMenu'));
    expect(calls).toHaveLength(1);
  });
});
