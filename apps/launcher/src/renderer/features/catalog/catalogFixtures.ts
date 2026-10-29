import type {
  CatalogDetail,
  CatalogListItem,
  DownloadSummary,
  InstalledItem,
} from '@nextlevel/shared';

// Catalog app test data: made-up homebrew titles, dummy checksums.

export const listItem = (overrides: Partial<CatalogListItem> = {}): CatalogListItem => ({
  id: 'i1',
  slug: 'star-hopper',
  title: 'Star Hopper',
  systemId: 'nintendo-nes',
  scope: 'homebrew-8bit',
  year: 2024,
  genre: 'Shooter',
  size: 8192,
  license: { type: 'freeware', rightsHolder: 'Pixel Moth' },
  starter: false,
  version: 1,
  publishedAt: '2026-10-28T10:00:00.000Z',
  boxArt: 'nextlevel://catalog-art/i1/box-front',
  installState: 'none',
  ...overrides,
});

export const detail = (overrides: Partial<CatalogDetail> = {}): CatalogDetail => ({
  ...listItem(),
  description: 'A tiny space shooter.',
  developer: 'Pixel Moth',
  publisher: '',
  players: 1,
  files: [
    { id: 'f1', filename: 'Star Hopper.nes', size: 8192, sha256: 'a'.repeat(64), role: 'rom' },
  ],
  media: [{ kind: 'screenshot-game-play', url: 'nextlevel://catalog-art/i1/screenshot-game-play' }],
  license: { type: 'freeware', rightsHolder: 'Pixel Moth', terms: 'Share it.' },
  ...overrides,
});

export const installed = (overrides: Partial<InstalledItem> = {}): InstalledItem => ({
  itemId: 'i1',
  gameId: 7,
  title: 'Star Hopper',
  systemId: 'nintendo-nes',
  version: 1,
  state: 'current',
  onLapse: 'keep',
  installedAt: '2026-10-28T10:00:00.000Z',
  ...overrides,
});

export const download = (overrides: Partial<DownloadSummary> = {}): DownloadSummary => ({
  id: 'd1',
  itemId: 'i1',
  title: 'Star Hopper',
  systemId: 'nintendo-nes',
  version: 1,
  state: 'downloading',
  pausedReason: null,
  bytesDone: 4096,
  bytesTotal: 8192,
  error: null,
  createdAt: '2026-10-28T10:00:00.000Z',
  ...overrides,
});
