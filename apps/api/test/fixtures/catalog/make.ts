import type { FileRole, LicenseInput } from '@nextlevel/shared';

// test-strategy §2 `fixtures/catalog`: five made-up homebrew items with small dummy files whose
// bytes are generated, not committed (no ROM data of any kind). `manifest.json` pins their SHA-256.

/** Deterministic pseudo-random bytes (xorshift32) after a short text header. */
function dummyBytes(header: string, size: number, seed: number): Buffer {
  const bytes = Buffer.alloc(size);
  const head = Buffer.from(`NEXTLEVEL TEST FIXTURE ${header}\n`, 'utf8');
  head.copy(bytes, 0, 0, Math.min(head.length, size));
  let x = seed >>> 0 || 1;
  for (let i = head.length; i < size; i += 1) {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    bytes[i] = x & 0xff;
  }
  return bytes;
}

export interface FixtureFile {
  filename: string;
  role: FileRole;
  bytes: () => Buffer;
}

export interface FixtureItem {
  slug: string;
  title: string;
  systemId: string;
  scopeSlug: string;
  year: number;
  license: LicenseInput;
  files: FixtureFile[];
}

const license = (rightsHolder: string, type: LicenseInput['type']): LicenseInput => ({
  type,
  rightsHolder,
  contact: `${rightsHolder.toLowerCase().replace(/[^a-z]+/g, '-')}@example.test`,
  terms: 'Test fixture: may be distributed by NextLevel to its subscribers.',
});

const file = (filename: string, role: FileRole, size: number, seed: number): FixtureFile => ({
  filename,
  role,
  bytes: () => dummyBytes(filename, size, seed),
});

export const CATALOG_FIXTURES: FixtureItem[] = [
  {
    slug: 'star-hopper',
    title: 'Star Hopper',
    systemId: 'nintendo-nes',
    scopeSlug: 'homebrew-8bit',
    year: 2021,
    license: license('Pixel Pals', 'author-permission'),
    files: [file('Star Hopper (v1.1).nes', 'rom', 8192, 1)],
  },
  {
    slug: 'moss-garden',
    title: 'Moss Garden',
    systemId: 'nintendo-game-boy',
    scopeSlug: 'homebrew-8bit',
    year: 2019,
    license: license('Fern Collective', 'freeware'),
    files: [file('Moss Garden.gb', 'rom', 8192, 2), file('manual.txt', 'extra', 1024, 3)],
  },
  {
    slug: 'orbit-drift',
    title: 'Orbit Drift',
    systemId: 'nintendo-snes',
    scopeSlug: 'homebrew-16bit',
    year: 2022,
    license: license('Lumen Studio', 'open-source'),
    files: [file('Orbit Drift.sfc', 'rom', 12288, 4)],
  },
  {
    slug: 'tide-runner',
    title: 'Tide Runner',
    systemId: 'sega-mega-drive',
    scopeSlug: 'homebrew-16bit',
    year: 2020,
    license: license('Harbor Lab', 'public-domain'),
    files: [file('Tide Runner.md', 'rom', 12288, 5)],
  },
  {
    slug: 'lantern-deep',
    title: 'Lantern Deep',
    systemId: 'sony-playstation',
    scopeSlug: 'demos',
    year: 2023,
    license: license('Glowworm Studio', 'author-permission'),
    files: [file('Lantern Deep.cue', 'disc', 512, 6), file('Lantern Deep.bin', 'disc', 16384, 7)],
  },
];
