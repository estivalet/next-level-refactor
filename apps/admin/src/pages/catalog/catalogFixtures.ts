// Console catalog test data (FR-ADM-3): made-up homebrew titles, dummy checksums.

export const SCOPES = [
  { id: 's1', slug: 'homebrew-8bit', name: '8-bit homebrew', description: '' },
];

export const HASH = 'a'.repeat(64);

export const file = (overrides: Record<string, unknown> = {}) => ({
  id: 'f1',
  filename: 'Star Hopper.nes',
  size: 8192,
  sha256: HASH,
  role: 'rom',
  status: 'ready',
  createdAt: '2026-10-28T10:00:00.000Z',
  ...overrides,
});

export const license = (overrides: Record<string, unknown> = {}) => ({
  id: 'l1',
  type: 'author-permission',
  rightsHolder: 'Pixel Moth',
  contact: 'moth@example.test',
  terms: 'May be distributed to subscribers.',
  territories: null,
  startsAt: null,
  expiresAt: null,
  evidenceFilename: null,
  verifiedBy: null,
  verifiedAt: null,
  ...overrides,
});

export const item = (overrides: Record<string, unknown> = {}) => ({
  id: 'i1',
  slug: 'star-hopper',
  title: 'Star Hopper',
  systemId: 'nintendo-nes',
  scopeSlug: 'homebrew-8bit',
  status: 'draft',
  starter: false,
  licenseState: 'none',
  version: 1,
  publishedAt: null,
  updatedAt: '2026-10-28T10:00:00.000Z',
  description: '',
  year: null,
  developer: '',
  publisher: '',
  genre: '',
  players: null,
  onLapse: null,
  license: null,
  files: [],
  media: [],
  publishBlockers: ['license', 'onLapse', 'files'],
  createdAt: '2026-10-28T10:00:00.000Z',
  ...overrides,
});

/** Everything publishing needs. */
export const ready = (overrides: Record<string, unknown> = {}) =>
  item({
    licenseState: 'verified',
    onLapse: 'keep',
    license: license({
      evidenceFilename: 'permission.txt',
      verifiedBy: { id: 'u1', email: 'admin@nextlevel.test' },
      verifiedAt: '2026-10-28T11:00:00.000Z',
    }),
    files: [file()],
    publishBlockers: [],
    ...overrides,
  });

export const refusal = (code: string, reason: string, status = 409) => ({
  status,
  body: { error: { code, message: 'm', requestId: 'r', details: { reason } } },
});
