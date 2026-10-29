import type { CatalogItem } from '@nextlevel/shared';

// Catalog test data: made-up homebrew titles, dummy checksums (no ROM data of any kind).

/** A catalog item as the API sends it. */
export const catalogItem = (overrides: Partial<CatalogItem> = {}): CatalogItem => ({
  id: 'i1',
  slug: 'star-hopper',
  title: 'Star Hopper',
  systemId: 'nintendo-nes',
  scope: 'homebrew-8bit',
  year: 2024,
  genre: 'Shooter',
  size: 30,
  license: { type: 'freeware', rightsHolder: 'Pixel Moth', terms: 'Share it.' },
  starter: false,
  version: 1,
  boxArt: null,
  description: '',
  developer: 'Pixel Moth',
  publisher: '',
  players: 1,
  files: [{ id: 'f1', filename: 'Star Hopper.nes', size: 30, sha256: 'a'.repeat(64), role: 'rom' }],
  media: [],
  ...overrides,
});
