import { describe, expect, it } from 'vitest';
import { ipcContract } from '../ipc/contract.ts';
import { GameScopeSchema } from './games.ts';
import { SmartFilterNameSchema, SmartFilterQuerySchema } from './smartFilters.ts';

describe('smart filter contracts', () => {
  it('FR-LIB-9: an empty query fills its defaults', () => {
    expect(SmartFilterQuerySchema.parse({})).toEqual({
      systems: [],
      played: 'any',
      sort: 'title',
    });
  });

  it('FR-LIB-9: a year range must not run backwards', () => {
    expect(SmartFilterQuerySchema.safeParse({ yearFrom: 2000, yearTo: 1990 }).success).toBe(false);
    expect(SmartFilterQuerySchema.safeParse({ yearFrom: 1990, yearTo: 1990 }).success).toBe(true);
  });

  it('FR-LIB-9: unknown keys and out-of-range values are refused', () => {
    expect(SmartFilterQuerySchema.safeParse({ rating: 5 }).success).toBe(false);
    expect(SmartFilterQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(SmartFilterQuerySchema.safeParse({ limit: 10001 }).success).toBe(false);
    expect(SmartFilterQuerySchema.safeParse({ minPlayers: 17 }).success).toBe(false);
    expect(SmartFilterQuerySchema.safeParse({ filters: ['Not A Slug'] }).success).toBe(false);
    expect(SmartFilterQuerySchema.safeParse({ favorite: false }).success).toBe(false);
  });

  it('FR-LIB-9: names are trimmed and 1..100 chars', () => {
    expect(SmartFilterNameSchema.parse(' Shooters ')).toBe('Shooters');
    expect(SmartFilterNameSchema.safeParse(' ').success).toBe(false);
  });

  it('FR-LIB-9: a smart filter is a game list scope and has IPC channels', () => {
    expect(GameScopeSchema.safeParse({ kind: 'smartFilter', smartFilterId: 3 }).success).toBe(true);
    const create = ipcContract['smartFilters.create'].input;
    expect(create.safeParse({ name: 'Recent', query: { played: 'played' } }).success).toBe(true);
    expect(ipcContract['smartFilters.update'].input.safeParse({ id: 1 }).success).toBe(false);
    expect(ipcContract['smartFilters.delete'].input.safeParse({ id: 1 }).success).toBe(true);
  });
});
