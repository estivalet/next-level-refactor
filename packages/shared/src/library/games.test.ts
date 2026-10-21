import { describe, expect, it } from 'vitest';
import { ipcContract } from '../ipc/contract.ts';
import { ipcEvents } from '../ipc/events.ts';
import { GameFlagsSchema, GameListQuerySchema, MetadataChangesSchema } from './games.ts';

describe('game contracts', () => {
  it('FR-LIB-6: metadata changes trim, null out empty text and reject an empty change', () => {
    expect(MetadataChangesSchema.parse({ developer: '  ' })).toEqual({ developer: null });
    expect(MetadataChangesSchema.parse({ title: '  Racer  ' })).toEqual({ title: 'Racer' });
    expect(MetadataChangesSchema.safeParse({ title: '' }).success).toBe(false);
    expect(MetadataChangesSchema.safeParse({}).success).toBe(false);
    expect(MetadataChangesSchema.safeParse({ filters: ['Hack'] }).success).toBe(false);
    expect(MetadataChangesSchema.safeParse({ filters: ['hack', 'homebrew'] }).success).toBe(true);
    expect(MetadataChangesSchema.safeParse({ year: 1949 }).success).toBe(false);
    expect(MetadataChangesSchema.safeParse({ year: null }).success).toBe(true);
    expect(MetadataChangesSchema.safeParse({ rating: 1 }).success).toBe(false);
  });

  it('FR-LIB-7: flags need at least one field and ratings stay 1..5', () => {
    expect(GameFlagsSchema.safeParse({}).success).toBe(false);
    expect(GameFlagsSchema.safeParse({ userRating: 6 }).success).toBe(false);
    expect(GameFlagsSchema.safeParse({ userRating: 0 }).success).toBe(false);
    expect(GameFlagsSchema.safeParse({ userRating: null }).success).toBe(true);
    expect(GameFlagsSchema.safeParse({ favorite: true, hidden: false }).success).toBe(true);
    const setFlags = ipcContract['library.games.setFlags'].input;
    expect(setFlags.safeParse({ gameIds: [], flags: { favorite: true } }).success).toBe(false);
    expect(setFlags.safeParse({ gameIds: [1], flags: { favorite: true } }).success).toBe(true);
  });

  it('FR-LIB-6: a game list query defaults to the All tab and caps the page', () => {
    const scope = { kind: 'system', systemId: 'nintendo-64' } as const;
    expect(GameListQuerySchema.parse({ scope, offset: 0, limit: 200 }).tab).toBe('all');
    expect(GameListQuerySchema.safeParse({ scope, offset: 0, limit: 1001 }).success).toBe(false);
    expect(
      GameListQuerySchema.safeParse({ scope: { kind: 'everything' }, offset: 0, limit: 10 }).success,
    ).toBe(false);
    expect(
      GameListQuerySchema.safeParse({
        scope: { kind: 'collection', collectionId: 3 },
        offset: 0,
        limit: 10,
        tab: 'favorites',
      }).success,
    ).toBe(true);
  });

  it('FR-LIB-10: library.changed may name the games it touched', () => {
    const changed = ipcEvents['library.changed'];
    expect(changed.safeParse({ systems: ['nintendo-64'], gameIds: [1, 2] }).success).toBe(true);
    expect(changed.safeParse({ systems: [] }).success).toBe(true);
    expect(ipcContract['library.search'].input.safeParse({ text: 'zelda' }).success).toBe(true);
  });
});
