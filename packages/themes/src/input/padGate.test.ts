import { defaultSettings, type GamepadButton, type InputAction } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { createPadGate } from './padGate.ts';

const input = defaultSettings().input;

/** Feeds held-button snapshots and collects what fired: held actions and taps. */
function run(frames: GamepadButton[][]) {
  const gate = createPadGate(input);
  return frames.map((held) => {
    const out = gate.step(new Set(held));
    return [...out.taps, ...out.held] as InputAction[];
  });
}

describe('createPadGate (FR-THM-3, US-C1)', () => {
  it('View then Start then releasing Start fires only toDesktop', () => {
    expect(run([['view'], ['view', 'start'], ['view'], []])).toEqual([[], ['toDesktop'], [], []]);
  });

  it('releasing View first after a chord fires nothing either', () => {
    expect(run([['start'], ['start', 'view'], ['start'], []])).toEqual([[], ['toDesktop'], [], []]);
  });

  it('a chord button pressed alone fires its own action on release', () => {
    expect(run([['view'], ['view'], []])).toEqual([[], [], ['help']]);
    expect(run([['start'], []])).toEqual([[], ['menu']]);
  });

  it('buttons outside any chord fire while held, as before', () => {
    expect(run([['a'], ['a'], []])).toEqual([['select'], ['select'], []]);
    expect(run([['dpadDown', 'a']])).toEqual([['down', 'select']]);
  });

  it('after a chord, pressing View alone again is a fresh tap', () => {
    expect(run([['view', 'start'], [], ['view'], []])).toEqual([['toDesktop'], [], [], ['help']]);
  });

  it('reset forgets a pending tap', () => {
    const gate = createPadGate(input);
    gate.step(new Set(['view']));
    gate.reset();
    expect(gate.step(new Set())).toEqual({ held: [], taps: [] });
  });
});
