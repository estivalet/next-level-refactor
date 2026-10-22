import type { InputAction } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { createRepeater } from './repeat.ts';

/** Steps every 10 ms from `from` to `to` with `held`, collecting the times each action fired. */
function hold(
  repeater: ReturnType<typeof createRepeater>,
  held: InputAction[],
  from: number,
  to: number,
) {
  const fired: Array<[number, InputAction]> = [];
  for (let now = from; now <= to; now += 10) {
    for (const { action } of repeater.step(new Set(held), now)) fired.push([now, action]);
  }
  return fired;
}

describe('createRepeater (US-C1)', () => {
  it('a held direction fires at once, after 400 ms, then 10 times a second', () => {
    const repeater = createRepeater({ delayMs: 400, rateHz: 10 });
    expect(hold(repeater, ['down'], 0, 1000).map(([at]) => at)).toEqual([
      0, 400, 500, 600, 700, 800, 900, 1000,
    ]);
  });

  it('a held button that does not repeat fires once', () => {
    const repeater = createRepeater({ delayMs: 400, rateHz: 10 });
    expect(hold(repeater, ['select'], 0, 1000)).toEqual([[0, 'select']]);
  });

  it('releasing stops the repeat; pressing again fires at once', () => {
    const repeater = createRepeater({ delayMs: 400, rateHz: 10 });
    hold(repeater, ['left'], 0, 450);
    expect(repeater.step(new Set(), 460)).toEqual([]);
    expect(hold(repeater, ['left'], 470, 800).map(([at]) => at)).toEqual([470]);
  });

  it('pageUp and pageDown repeat too', () => {
    const repeater = createRepeater({ delayMs: 400, rateHz: 10 });
    expect(hold(repeater, ['pageDown'], 0, 500)).toHaveLength(3);
  });

  it('reset forgets held actions', () => {
    const repeater = createRepeater({ delayMs: 400, rateHz: 10 });
    hold(repeater, ['up'], 0, 300);
    repeater.reset();
    expect(repeater.step(new Set(['up']), 310)).toEqual([{ action: 'up', repeat: false }]);
  });

  it('marks the press and the repeats apart', () => {
    const repeater = createRepeater({ delayMs: 400, rateHz: 10 });
    expect(repeater.step(new Set(['up']), 0)).toEqual([{ action: 'up', repeat: false }]);
    // The input loop steps every frame.
    for (let now = 16; now < 400; now += 16)
      expect(repeater.step(new Set(['up']), now)).toEqual([]);
    expect(repeater.step(new Set(['up']), 400)).toEqual([{ action: 'up', repeat: true }]);
  });

  it('a stalled main thread is not hold time: a press whose keyup is queued fires once', () => {
    const repeater = createRepeater({ delayMs: 400, rateHz: 10 });
    const held = new Set<InputAction>(['right']);
    expect(repeater.step(held, 0)).toHaveLength(1);
    // The renderer was busy for 600 ms; the keyup is still in the queue.
    expect(repeater.step(held, 600)).toEqual([]);
    expect(repeater.step(new Set(), 616)).toEqual([]);
  });

  it('after a stall while really held, repeats resume at the rate instead of bursting', () => {
    const repeater = createRepeater({ delayMs: 400, rateHz: 10 });
    const fired = [
      ...hold(repeater, ['down'], 0, 500), // 0, 400, 500
      ...hold(repeater, ['down'], 2000, 2300), // a 1.5 s stall, then frames again
    ].map(([at]) => at);
    expect(fired.slice(0, 3)).toEqual([0, 400, 500]);
    const after = fired.slice(3);
    expect(after.length).toBeLessThanOrEqual(4);
    for (let i = 1; i < after.length; i++) {
      expect((after[i] ?? 0) - (after[i - 1] ?? 0)).toBeGreaterThanOrEqual(100);
    }
  });
});
