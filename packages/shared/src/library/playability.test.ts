import { describe, expect, it } from 'vitest';
import { ipcContract } from '../ipc/contract.ts';
import { GameDetailsSchema } from './games.ts';
import { PLAYABILITY_MARKS, PlayabilityChangeSchema } from './playability.ts';
import { SmartFilterQuerySchema } from './smartFilters.ts';

describe('playability (FR-LIB-13)', () => {
  it('has three marks', () => {
    expect(PLAYABILITY_MARKS).toEqual(['works', 'issues', 'broken']);
  });

  it('a change sets a mark with an optional trimmed note, or clears it with null', () => {
    expect(PlayabilityChangeSchema.parse({ mark: 'issues', note: '  sound crackles ' })).toEqual({
      mark: 'issues',
      note: 'sound crackles',
    });
    expect(PlayabilityChangeSchema.parse({ mark: 'works' })).toEqual({ mark: 'works' });
    expect(PlayabilityChangeSchema.parse({ mark: null })).toEqual({ mark: null });
    expect(PlayabilityChangeSchema.safeParse({ mark: 'meh' }).success).toBe(false);
    expect(
      PlayabilityChangeSchema.safeParse({ mark: 'works', note: 'x'.repeat(501) }).success,
    ).toBe(false);
  });

  it('game details carry the mark, note and date, or null', () => {
    expect(GameDetailsSchema.shape.playability.parse(null)).toBeNull();
    expect(
      GameDetailsSchema.shape.playability.parse({
        mark: 'broken',
        note: '',
        at: '2026-11-03T10:00:00.000Z',
      }),
    ).toMatchObject({ mark: 'broken' });
  });

  it('the IPC sets it on several games', () => {
    const input = ipcContract['library.games.setPlayability'].input;
    expect(input.safeParse({ gameIds: [1, 2], change: { mark: 'works' } }).success).toBe(true);
    expect(input.safeParse({ gameIds: [], change: { mark: 'works' } }).success).toBe(false);
  });

  it('smart filters match any of the marks or unmarked games', () => {
    expect(SmartFilterQuerySchema.parse({ playability: ['broken', 'unset'] })).toMatchObject({
      playability: ['broken', 'unset'],
    });
    expect(SmartFilterQuerySchema.safeParse({ playability: [] }).success).toBe(false);
  });
});
