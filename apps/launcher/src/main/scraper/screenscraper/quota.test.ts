import { describe, expect, it } from 'vitest';
import { nextParisMidnight, QuotaGate } from './quota.ts';

function fakeTime(start = Date.UTC(2026, 0, 10, 12)) {
  let now = start;
  return {
    clock: () => now,
    sleep: (ms: number) =>
      new Promise<void>((resolve) => {
        now += ms;
        setTimeout(resolve, 0);
      }),
  };
}

describe('QuotaGate (FR-SCR-2)', () => {
  it('with maxthreads 1 two calls never overlap', async () => {
    const time = fakeTime();
    const gate = new QuotaGate({ ...time, minIntervalMs: 0 });
    let active = 0;
    let most = 0;
    const work = () =>
      gate.run(async () => {
        active += 1;
        most = Math.max(most, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
      });
    await Promise.all([work(), work(), work()]);
    expect(most).toBe(1);
  });

  it('allows as many calls at once as ssuser.maxthreads', async () => {
    const gate = new QuotaGate({ ...fakeTime(), minIntervalMs: 0 });
    gate.update({ maxthreads: '2' });
    let active = 0;
    let most = 0;
    const work = () =>
      gate.run(async () => {
        active += 1;
        most = Math.max(most, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
      });
    await Promise.all([work(), work(), work(), work()]);
    expect(most).toBe(2);
  });

  it('spaces request starts by 1.2 s by default, or by maxrequestspermin', async () => {
    const time = fakeTime();
    const starts: number[] = [];
    const gate = new QuotaGate(time);
    const work = () =>
      gate.run(() => {
        starts.push(time.clock());
        return Promise.resolve();
      });
    await work();
    await work();
    expect((starts[1] ?? 0) - (starts[0] ?? 0)).toBe(1200);
    gate.update({ maxrequestspermin: '120' });
    await work();
    await work();
    expect((starts[3] ?? 0) - (starts[2] ?? 0)).toBe(500);
  });

  it('a failing call releases its slot', async () => {
    const gate = new QuotaGate({ ...fakeTime(), minIntervalMs: 0 });
    await expect(gate.run(() => Promise.reject(new Error('x')))).rejects.toThrow('x');
    await expect(gate.run(() => Promise.resolve(1))).resolves.toBe(1);
  });

  it('records the daily counts from ssuser and when the quota resets', () => {
    const time = fakeTime();
    const gate = new QuotaGate(time);
    expect(gate.state()).toEqual({ requestsToday: null, maxPerDay: null, exhaustedUntil: null });
    gate.update({ requeststoday: '19999', maxrequestsperday: '20000' });
    gate.exhausted();
    expect(gate.state()).toEqual({
      requestsToday: 19999,
      maxPerDay: 20000,
      exhaustedUntil: '2026-01-10T23:00:00.000Z',
    });
  });
});

describe('nextParisMidnight', () => {
  it('uses the Paris offset of the coming midnight (summer time, the day it ends)', () => {
    expect(nextParisMidnight(Date.UTC(2026, 9, 24, 20))).toBe('2026-10-24T22:00:00.000Z');
    expect(nextParisMidnight(Date.UTC(2026, 9, 25, 12))).toBe('2026-10-25T23:00:00.000Z');
    expect(nextParisMidnight(Date.UTC(2026, 0, 10, 23, 30))).toBe('2026-01-11T23:00:00.000Z');
  });
});
