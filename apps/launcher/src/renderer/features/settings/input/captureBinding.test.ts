import { describe, expect, it } from 'vitest';
import { captureStep, IDLE_CAPTURE, type CaptureState } from './captureBinding.ts';

const keyTarget = { action: 'random', device: 'keyboard' } as const;
const padTarget = { action: 'random', device: 'gamepad' } as const;

function run(events: Parameters<typeof captureStep>[1][]): CaptureState {
  return events.reduce(captureStep, IDLE_CAPTURE);
}

describe('captureStep', () => {
  it('FR-THM-3: the next key becomes the binding', () => {
    const state = run([
      { type: 'start', target: keyTarget, now: 0 },
      { type: 'key', code: 'KeyG' },
    ]);
    expect(state.result).toEqual({ target: keyTarget, binding: 'KeyG' });
    expect(state.target).toBeNull();
  });

  it('FR-THM-3: Escape cancels without a binding', () => {
    const state = run([
      { type: 'start', target: keyTarget, now: 0 },
      { type: 'key', code: 'Escape' },
    ]);
    expect(state).toEqual(IDLE_CAPTURE);
  });

  it('FR-THM-3: a pad binding is the buttons held together, completed on release', () => {
    const state = run([
      { type: 'start', target: padTarget, now: 0 },
      { type: 'pad', pressed: ['start'] },
      { type: 'pad', pressed: ['start', 'view'] },
      { type: 'pad', pressed: ['view'] },
    ]);
    expect(state.result).toBeUndefined();
    const done = captureStep(state, { type: 'pad', pressed: [] });
    expect(done.result).toEqual({ target: padTarget, binding: 'view+start' });
  });

  it('FR-THM-3: a third button does not make a three-button chord', () => {
    const state = run([
      { type: 'start', target: padTarget, now: 0 },
      { type: 'pad', pressed: ['a', 'b'] },
      { type: 'pad', pressed: ['a', 'b', 'x'] },
      { type: 'pad', pressed: [] },
    ]);
    expect(state.result?.binding).toBe('a+b');
  });

  it('FR-THM-3: keys are ignored while capturing a button, pads while capturing a key', () => {
    const pad = run([
      { type: 'start', target: padTarget, now: 0 },
      { type: 'key', code: 'KeyG' },
    ]);
    expect(pad.target).toEqual(padTarget);
    const key = run([
      { type: 'start', target: keyTarget, now: 0 },
      { type: 'pad', pressed: ['a'] },
      { type: 'pad', pressed: [] },
    ]);
    expect(key.target).toEqual(keyTarget);
  });

  it('FR-THM-3: capture gives up after 5 s', () => {
    const waiting = run([
      { type: 'start', target: keyTarget, now: 1000 },
      { type: 'tick', now: 5999 },
    ]);
    expect(waiting.target).toEqual(keyTarget);
    expect(captureStep(waiting, { type: 'tick', now: 6000 })).toEqual(IDLE_CAPTURE);
  });
});
