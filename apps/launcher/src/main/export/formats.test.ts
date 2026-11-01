import { describe, expect, it } from 'vitest';
import { renderExport, type ExportGame } from './formats.ts';

const game = (overrides: Partial<ExportGame> = {}): ExportGame => ({
  title: 'Racer',
  system: 'Nintendo 64',
  year: 1997,
  genre: 'Racing',
  players: '1-4',
  developer: 'Studio',
  publisher: null,
  region: 'us',
  description: 'Fast cars.',
  rating: 4,
  userRating: 5,
  favorite: true,
  completed: false,
  hidden: false,
  missing: false,
  path: 'X:\\roms\\n64\\Racer.zip',
  relPath: 'sub\\Racer.zip',
  playCount: 3,
  lastPlayed: '2026-10-21T12:34:56.000Z',
  added: '2026-10-01T00:00:00.000Z',
  filters: ['hack', 'homebrew'],
  ...overrides,
});

const meta = { title: 'Nintendo 64', exportedAt: '2026-11-01T10:00:00.000Z' };

describe('export formats', () => {
  it('FR-LIB-11: CSV has a header of the picked fields, quotes what needs it and opens in Excel', () => {
    const text = renderExport(
      'csv',
      [game(), game({ title: 'Say "Hi", World', year: null, filters: [] })],
      ['title', 'year', 'favorite', 'filters'],
      meta,
    );
    expect(text.startsWith('\uFEFF')).toBe(true);
    expect(text.slice(1).split('\r\n')).toEqual([
      'title,year,favorite,filters',
      'Racer,1997,true,hack; homebrew',
      '"Say ""Hi"", World",,true,',
      '',
    ]);
  });

  it('FR-LIB-11: CSV quotes line breaks inside a description', () => {
    const text = renderExport('csv', [game({ description: 'One\nTwo' })], ['description'], meta);
    expect(text).toContain('Racer,"One\nTwo"');
  });

  it('FR-LIB-11: JSON holds typed values of the picked fields only', () => {
    const parsed = JSON.parse(
      renderExport('json', [game()], ['title', 'year', 'missing', 'filters'], meta),
    ) as unknown;
    expect(parsed).toEqual({
      title: 'Nintendo 64',
      exportedAt: '2026-11-01T10:00:00.000Z',
      count: 1,
      fields: ['title', 'year', 'missing', 'filters'],
      games: [{ title: 'Racer', year: 1997, missing: false, filters: ['hack', 'homebrew'] }],
    });
  });

  it('FR-LIB-11: gamelist.xml uses ES tags, a relative path and escapes text', () => {
    const text = renderExport(
      'gamelistXml',
      [game({ title: 'Tom & Jerry <Deluxe>', publisher: null })],
      ['title', 'year', 'publisher', 'rating', 'favorite', 'completed', 'playCount', 'lastPlayed'],
      meta,
    );
    expect(text).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<gameList>',
        '  <game>',
        '    <path>./sub/Racer.zip</path>',
        '    <name>Tom &amp; Jerry &lt;Deluxe&gt;</name>',
        '    <releasedate>19970101T000000</releasedate>',
        '    <rating>0.8</rating>',
        '    <favorite>true</favorite>',
        '    <playcount>3</playcount>',
        '    <lastplayed>20261021T123456</lastplayed>',
        '  </game>',
        '</gameList>',
        '',
      ].join('\n'),
    );
  });

  it('FR-LIB-11: gamelist.xml drops characters XML 1.0 cannot hold', () => {
    const text = renderExport('gamelistXml', [game({ title: 'Bad\u0001Name' })], ['title'], meta);
    expect(text).toContain('<name>BadName</name>');
  });
});
