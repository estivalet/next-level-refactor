import { describe, expect, it } from 'vitest';
import { firstStandardPad, readPad, type PadSnapshot } from './gamepad.ts';

function pad(
  pressed: number[] = [],
  axes: number[] = [0, 0, 0, 0],
  mapping = 'standard',
): PadSnapshot {
  return {
    mapping,
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })),
  };
}

describe('readPad (US-C1)', () => {
  it('names the pressed standard-mapping buttons', () => {
    expect([...readPad(pad([0, 13]))]).toEqual(['a', 'dpadDown']);
  });

  it('the left stick counts only past the deadzone', () => {
    expect([...readPad(pad([], [0, 0.4]))]).toEqual([]);
    expect([...readPad(pad([], [0, 0.6]))]).toEqual(['lsDown']);
    expect([...readPad(pad([], [-0.9, -0.7]))]).toEqual(['lsLeft', 'lsUp']);
  });

  it('a pad without the standard mapping reads as nothing', () => {
    expect([...readPad(pad([0], [0, 0], ''))]).toEqual([]);
  });

  it('the first connected standard pad wins', () => {
    const odd = pad([0], [0, 0], '');
    const good = pad([1]);
    expect(firstStandardPad([null, odd, good])).toBe(good);
    expect(firstStandardPad([null])).toBeNull();
  });
});
