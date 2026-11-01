import { describe, expect, it } from 'vitest';
import { ipcContract } from '../ipc/contract.ts';
import { DEFAULT_EXPORT_FIELDS, GameExportRequestSchema, exportedFields } from './export.ts';

const scope = { kind: 'system', systemId: 'nintendo-64' } as const;

describe('game list export contract', () => {
  it('FR-LIB-11: a request needs a format, fields without duplicates and a title', () => {
    const base = { scope, view: null, format: 'csv', fields: ['title'], title: 'N64' };
    expect(GameExportRequestSchema.safeParse(base).success).toBe(true);
    expect(GameExportRequestSchema.safeParse({ ...base, format: 'xls' }).success).toBe(false);
    expect(GameExportRequestSchema.safeParse({ ...base, fields: [] }).success).toBe(false);
    expect(GameExportRequestSchema.safeParse({ ...base, fields: ['title', 'title'] }).success).toBe(
      false,
    );
    expect(GameExportRequestSchema.safeParse({ ...base, fields: ['rom'] }).success).toBe(false);
    expect(GameExportRequestSchema.safeParse({ ...base, title: ' ' }).success).toBe(false);
    expect(
      GameExportRequestSchema.safeParse({ ...base, view: { tab: 'favorites', genre: 'Racing' } })
        .success,
    ).toBe(true);
    expect(ipcContract['library.export'].input).toBe(GameExportRequestSchema);
  });

  it('FR-LIB-11: title is always written; gamelist.xml adds path and drops fields it has no tag for', () => {
    expect(exportedFields('csv', ['year'])).toEqual(['title', 'year']);
    expect(exportedFields('json', ['filters', 'title', 'year'])).toEqual([
      'title',
      'year',
      'filters',
    ]);
    expect(exportedFields('gamelistXml', ['year', 'userRating', 'missing', 'filters'])).toEqual([
      'title',
      'year',
      'path',
    ]);
  });

  it('FR-LIB-11: the default fields leave the description out', () => {
    expect(DEFAULT_EXPORT_FIELDS).not.toContain('description');
    expect(DEFAULT_EXPORT_FIELDS).toContain('title');
  });
});
