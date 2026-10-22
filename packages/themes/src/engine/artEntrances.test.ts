// Cases ported from NextLevelOS src/themes/engine/artEntrances.test.ts @ 3d530b7.
import { describe, expect, it } from 'vitest';
import { ART_ENTRANCES, ART_ENTRANCE_NAMES, pickEntrance } from './artEntrances.ts';

const NEUTRAL = { x: 0, y: 0, scale: 1, rotate: 0, rotateY: 0, opacity: 1 };

describe('ART_ENTRANCES (FR-THM-1)', () => {
  it('has an entry for every name, each ending at the neutral pose', () => {
    expect(ART_ENTRANCE_NAMES).toHaveLength(10);
    for (const name of ART_ENTRANCE_NAMES) {
      expect(ART_ENTRANCES[name].animate).toEqual(NEUTRAL);
      expect(ART_ENTRANCES[name].transition).toBeTruthy();
    }
  });
  it('slide-left enters from the left and slide-right from the right', () => {
    expect(ART_ENTRANCES['slide-left'].initial.x).toBe('-120%');
    expect(ART_ENTRANCES['slide-right'].initial.x).toBe('120%');
  });
});

describe('pickEntrance (FR-THM-1)', () => {
  it('picks by rand', () => {
    expect(pickEntrance(['drop', 'zoom-in', 'spin-in'], () => 0)).toBe('drop');
    expect(pickEntrance(['drop', 'zoom-in', 'spin-in'], () => 0.5)).toBe('zoom-in');
    expect(pickEntrance(['drop', 'zoom-in', 'spin-in'], () => 0.999)).toBe('spin-in');
  });
  it('falls back to fade for an empty pool', () => {
    expect(pickEntrance([], () => 0.3)).toBe('fade');
  });
});
