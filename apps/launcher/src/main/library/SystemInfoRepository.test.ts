import type { SystemInfo } from '@nextlevel/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SystemInfoRepository } from './SystemInfoRepository.ts';
import { seedGames, tempLibrary } from './testing.ts';

let lib: Awaited<ReturnType<typeof tempLibrary>>;
let repo: SystemInfoRepository;

beforeEach(async () => {
  lib = await tempLibrary();
  repo = new SystemInfoRepository(lib.db, () => new Date(Date.UTC(2026, 10, 15)));
});
afterEach(() => lib.cleanup());

const entry = (extra: Partial<SystemInfo> = {}): SystemInfo => ({
  systemId: 'snes',
  fullName: 'Super Nintendo',
  models: [{ name: 'Mini' }],
  peripherals: [],
  topGames: [],
  sources: [],
  ...extra,
});

describe('SystemInfoRepository', () => {
  it('FR-MUS-2: save then get returns the entry; reset removes it', () => {
    expect(repo.get('snes')).toBeNull();
    const saved = repo.save(entry());
    expect(repo.get('snes')).toEqual(saved);
    expect(repo.editedIds()).toEqual(new Set(['snes']));
    repo.reset('snes');
    expect(repo.get('snes')).toBeNull();
    expect(repo.editedIds().size).toBe(0);
  });

  it('FR-MUS-2: save replaces the whole entry', () => {
    repo.save(entry());
    repo.save({ systemId: 'snes', fullName: 'Second' } as SystemInfo);
    const stored = repo.get('snes');
    expect(stored?.fullName).toBe('Second');
    expect(stored?.models).toEqual([]);
  });

  it('FR-MUS-2: a corrupt stored row reads as null', () => {
    lib.db.$client
      .prepare("insert into system_info (system_id, entry, updated_at) values ('snes', ?, 'now')")
      .run('{not json');
    expect(repo.get('snes')).toBeNull();
    lib.db.$client.prepare('update system_info set entry = \'{"systemId":1}\'').run();
    expect(repo.get('snes')).toBeNull();
  });

  it('FR-MUS-3: a pinned game wins over a title match', () => {
    const [match, pinned] = seedGames(lib.db, 'snes', ['Super Metroid', 'Other']);
    const [resolved] = repo.resolveTopGames('snes', [{ title: 'Super Metroid', gameId: pinned }]);
    expect(resolved?.owned).toEqual({ gameId: pinned });
    expect(match).not.toBe(pinned);
  });

  it('FR-MUS-3: a pinned game that is missing falls back to the title match, else null', () => {
    const [gone, match] = seedGames(lib.db, 'snes', [
      { title: 'Zelda', missing: true },
      'Zelda (USA)',
    ]);
    const [fallback, none] = repo.resolveTopGames('snes', [
      { title: 'Zelda', gameId: gone },
      { title: 'Chrono Trigger', gameId: gone },
    ]);
    expect(fallback?.owned).toEqual({ gameId: match });
    expect(none?.owned).toBeNull();
  });

  it('FR-MUS-3: title match ignores region tags and case', () => {
    const [first] = seedGames(lib.db, 'snes', ['STAR FOX (Europe) [!]', 'Star Fox']);
    seedGames(lib.db, 'nes', ['Metroid']);
    const [a, b] = repo.resolveTopGames('snes', [{ title: 'star fox' }, { title: 'Metroid' }]);
    expect(a?.owned).toEqual({ gameId: first });
    expect(b?.owned).toBeNull();
  });
});
