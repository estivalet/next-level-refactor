import { SmartFilterQuerySchema } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { EMPTY_SMART_FORM, fromQuery, toQuery } from './smartFilterForm.ts';

describe('FR-LIB-9 smart filter form', () => {
  it('turns filled fields into a query and leaves blank ones out', () => {
    const result = toQuery({
      ...EMPTY_SMART_FORM,
      name: ' Shooters ',
      genre: 'shoot',
      filters: 'hack, homebrew',
      yearFrom: '1990',
      limit: '100',
      sort: 'year',
    });
    expect(result).toEqual({
      ok: true,
      name: 'Shooters',
      query: SmartFilterQuerySchema.parse({
        genre: 'shoot',
        filters: ['hack', 'homebrew'],
        yearFrom: 1990,
        limit: 100,
        sort: 'year',
      }),
    });
  });

  it('round-trips a query through the form', () => {
    const query = SmartFilterQuerySchema.parse({
      systems: ['snes'],
      favorite: true,
      minPlayers: 2,
      played: 'played',
      playedWithinDays: 30,
      sort: 'lastPlayed',
      limit: 50,
    });
    const result = toQuery(fromQuery('Recent', query));
    expect(result).toEqual({ ok: true, name: 'Recent', query });
  });

  it('a year range that runs backwards is an error on Year to', () => {
    const result = toQuery({ ...EMPTY_SMART_FORM, name: 'X', yearFrom: '1995', yearTo: '1990' });
    expect(result).toEqual({ ok: false, errors: { yearTo: 'library.smart.errors.yearRange' } });
  });

  it('names a field that is not a whole number or out of range, and a missing name', () => {
    const result = toQuery({ ...EMPTY_SMART_FORM, yearFrom: 'abc', minPlayers: '99' });
    expect(result).toEqual({
      ok: false,
      errors: {
        name: 'library.smart.errors.name',
        yearFrom: 'library.smart.errors.yearFrom',
        minPlayers: 'library.smart.errors.minPlayers',
      },
    });
  });

  it('a filter tag with characters tags never have is an error', () => {
    const result = toQuery({ ...EMPTY_SMART_FORM, name: 'X', filters: 'Hack Mods' });
    expect(result).toEqual({ ok: false, errors: { filters: 'library.smart.errors.filters' } });
  });
});
