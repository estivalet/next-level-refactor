import { defaultSettings, type GamepadButton } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { chordActions, firstStandardPad, readPad, type PadSnapshot } from './gamepad.ts';

const input = defaultSettings().input;

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

describe('chordActions (FR-THM-3)', () => {
  const held = (...buttons: GamepadButton[]) => chordActions(new Set(buttons), input);

  it('maps held buttons to actions', () => {
    expect(held('a')).toEqual(['select']);
    expect(held('dpadUp', 'lsUp')).toEqual(['up']);
  });

  it('a chord beats the single-button bindings of its buttons', () => {
    expect(held('view', 'start')).toEqual(['toDesktop']);
    expect(held('view')).toEqual(['help']);
    expect(held('start', 'a')).toEqual(['select', 'menu']);
  });
});
