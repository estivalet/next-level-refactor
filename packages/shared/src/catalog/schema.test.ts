import { describe, expect, it } from 'vitest';
import { SystemCatalogSchema, SystemDefinitionSchema } from './schema.ts';

const n64 = {
  id: 'nintendo-64',
  name: 'Nintendo 64',
  manufacturer: 'Nintendo',
  kind: 'console',
  extensions: ['z64', 'n64', 'zip'],
  defaultFolderName: 'Nintendo 64',
  scraper: { screenscraperId: 14 },
  presetProfiles: [],
  aliases: ['Nintendo 64'],
};

describe('SystemDefinitionSchema', () => {
  it('FR-EMU-1: accepts a complete definition; manufacturer and year are optional', () => {
    expect(SystemDefinitionSchema.safeParse(n64).success).toBe(true);
    expect(SystemDefinitionSchema.safeParse({ ...n64, manufacturer: undefined }).success).toBe(
      true,
    );
  });

  it('FR-EMU-1: catalog ids must be slugs', () => {
    for (const id of ['Nintendo 64', 'n64_', '-n64', 'n--64', 'N64']) {
      expect(SystemDefinitionSchema.safeParse({ ...n64, id }).success, id).toBe(false);
    }
  });

  it('FR-EMU-1: a system needs at least one lowercase, dotless extension', () => {
    expect(SystemDefinitionSchema.safeParse({ ...n64, extensions: [] }).success).toBe(false);
    expect(SystemDefinitionSchema.safeParse({ ...n64, extensions: ['.z64'] }).success).toBe(false);
    expect(SystemDefinitionSchema.safeParse({ ...n64, extensions: ['Z64'] }).success).toBe(false);
  });

  it('a catalog carries its source', () => {
    expect(SystemCatalogSchema.safeParse({ source: 'es-de v3', systems: [n64] }).success).toBe(
      true,
    );
  });
});
