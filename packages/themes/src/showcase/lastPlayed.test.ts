// Cases ported from NextLevelOS src/themes/showcase/lastPlayed.test.ts @ 3d530b7: the game's
// `lastPlayedAt` is ISO, and the wording is i18n (see GamesView.test.tsx).
import { describe, expect, it } from 'vitest';
import { lastPlayed } from './lastPlayed.ts';

const NOW = new Date('2026-07-22T16:49:00Z');

describe('lastPlayed (FR-THM-1)', () => {
  it('hours ago', () => {
    expect(lastPlayed('2026-07-21T19:49:00Z', NOW)).toEqual({ unit: 'hours', count: 21 });
  });

  it('singular units', () => {
    expect(lastPlayed('2026-07-22T15:49:00Z', NOW)).toEqual({ unit: 'hours', count: 1 });
    expect(lastPlayed('2026-07-22T16:48:00Z', NOW)).toEqual({ unit: 'minutes', count: 1 });
    expect(lastPlayed('2026-07-21T16:49:00Z', NOW)).toEqual({ unit: 'days', count: 1 });
  });

  it('days ago', () => {
    expect(lastPlayed('2026-07-16T19:00:36Z', NOW)).toEqual({ unit: 'days', count: 5 });
  });

  it('a date after 30 days', () => {
    expect(lastPlayed('2025-01-02T10:00:00Z', NOW)).toEqual({
      unit: 'date',
      date: new Date('2025-01-02T10:00:00Z'),
    });
  });

  it('just now, also for a future date', () => {
    expect(lastPlayed('2026-07-22T16:48:40Z', NOW)).toEqual({ unit: 'now' });
    expect(lastPlayed('2026-07-23T16:49:00Z', NOW)).toEqual({ unit: 'now' });
  });

  it('missing or unparsable → null', () => {
    expect(lastPlayed(null, NOW)).toBeNull();
    expect(lastPlayed('', NOW)).toBeNull();
    expect(lastPlayed('not a date', NOW)).toBeNull();
  });
});
