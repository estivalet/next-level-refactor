import { describe, expect, it } from 'vitest';
import { checkAnswer } from './checks.ts';

const now = new Date('2026-11-03T12:00:00Z');
const game = { gameId: 7, title: 'Tennis' };
const unknown = { known: false, value: null };

/** The checked value of one field for a raw `{ known: true, value }`. */
function one(field: 'year' | 'players' | 'developer' | 'description', value: unknown) {
  return checkAnswer({ gameId: 7, [field]: { known: true, value } }, game, [field], now).fields[
    field
  ];
}

describe('checkAnswer (FR-SCR-7: unknown stays unknown)', () => {
  it.each([[1949], [2099], ['19xx'], ['197'], [null]])('FR-SCR-7: year %s is unknown', (value) => {
    expect(one('year', value)).toEqual(unknown);
  });

  it('FR-SCR-7: a good year passes as a number', () => {
    expect(one('year', '1976')).toEqual({ known: true, value: 1976 });
    expect(one('year', 2026)).toEqual({ known: true, value: 2026 });
  });

  it.each([['17'], ['one'], ['1-17'], ['2-'], ['']])('FR-SCR-7: players %s is unknown', (value) => {
    expect(one('players', value)).toEqual(unknown);
  });

  it('FR-SCR-7: good player counts pass as text', () => {
    expect(one('players', '1-2')).toEqual({ known: true, value: '1-2' });
    expect(one('players', 4)).toEqual({ known: true, value: '4' });
  });

  it.each([['N/A'], ['Unknown'], ['  none '], ['?'], ['-'], ['TBD'], ['na'], ['x'.repeat(101)]])(
    'FR-SCR-7: developer %s is unknown',
    (value) => {
      expect(one('developer', value)).toEqual(unknown);
    },
  );

  it('FR-SCR-7: text is trimmed', () => {
    expect(one('developer', '  Coleco ')).toEqual({ known: true, value: 'Coleco' });
  });

  it.each([
    ['x'.repeat(601)],
    ["I'm sorry, I have no information about this game."],
    ['I cannot find details for that title.'],
    ["I don't have reliable data."],
    ['As an AI, I do not know.'],
    [''],
  ])('FR-SCR-7: description %s is unknown', (value) => {
    expect(one('description', value)).toEqual(unknown);
  });

  it('FR-SCR-7: known:false or a missing field is unknown, even with a value', () => {
    const checked = checkAnswer(
      { gameId: 7, year: { known: false, value: 1976 } },
      game,
      ['year', 'developer'],
      now,
    );
    expect(checked.fields).toEqual({ year: unknown, developer: unknown });
  });

  it('FR-SCR-7: fields that were not asked are dropped', () => {
    const checked = checkAnswer(
      {
        gameId: 7,
        year: { known: true, value: 1976 },
        publisher: { known: true, value: 'Coleco' },
      },
      game,
      ['year'],
      now,
    );
    expect(checked.fields).toEqual({ year: { known: true, value: 1976 } });
  });

  it('FR-SCR-7: a title suggestion that only differs in case or punctuation is dropped', () => {
    const title = (value: string) =>
      checkAnswer({ gameId: 7, title: { known: true, value } }, game, ['year'], now).title;
    expect(title('TENNIS!')).toBeNull();
    expect(title('Telstar Tennis')).toBe('Telstar Tennis');
    expect(
      checkAnswer({ gameId: 7, title: { known: false, value: 'X' } }, game, ['year'], now).title,
    ).toBeNull();
  });

  it('FR-SCR-7: a malformed item is all unknown', () => {
    expect(checkAnswer('nope', game, ['year'], now)).toEqual({
      fields: { year: unknown },
      title: null,
    });
  });
});
