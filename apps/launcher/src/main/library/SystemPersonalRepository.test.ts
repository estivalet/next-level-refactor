import { emptyPersonal, type SystemInfo, type SystemPersonal } from '@nextlevel/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SystemInfoRepository } from './SystemInfoRepository.ts';
import { SystemPersonalRepository } from './SystemPersonalRepository.ts';
import { tempLibrary } from './testing.ts';

let lib: Awaited<ReturnType<typeof tempLibrary>>;
let repo: SystemPersonalRepository;

beforeEach(async () => {
  lib = await tempLibrary();
  repo = new SystemPersonalRepository(lib.db, () => new Date(Date.UTC(2026, 10, 16)));
});
afterEach(() => lib.cleanup());

const FILE = '123e4567-e89b-42d3-a456-426614174000.png';
const personal = (extra: Partial<SystemPersonal> = {}): SystemPersonal => ({
  systemId: 'snes',
  notes: 'My first console',
  gallery: [{ file: FILE, caption: 'Box' }],
  ...extra,
});

describe('SystemPersonalRepository', () => {
  it('FR-MUS-6: get of an unknown system is the empty record', () => {
    expect(repo.get('snes')).toEqual(emptyPersonal('snes'));
  });

  it('FR-MUS-6: save then get round-trips notes and gallery', () => {
    const saved = repo.save(personal());
    expect(repo.get('snes')).toEqual(saved);
    expect(saved.gallery).toHaveLength(1);
  });

  it('FR-MUS-6: saving an empty record deletes the row (summary no longer lists it)', () => {
    repo.save(personal());
    expect(repo.summary().has('snes')).toBe(true);
    repo.save(emptyPersonal('snes'));
    expect(repo.summary().has('snes')).toBe(false);
    expect(repo.get('snes')).toEqual(emptyPersonal('snes'));
  });

  it('FR-MUS-6: a row that no longer validates reads as empty', () => {
    lib.db.$client
      .prepare('insert into system_personal (system_id, data, updated_at) values (?, ?, ?)')
      .run('snes', '{"systemId":"snes","gallery":[{"file":"../evil.png"}]}', 'x');
    expect(repo.get('snes')).toEqual(emptyPersonal('snes'));
    lib.db.$client.prepare('update system_personal set data = ?').run('not json');
    expect(repo.get('snes')).toEqual(emptyPersonal('snes'));
  });

  it('FR-MUS-9: summary reports hasNotes and updatedAt', () => {
    repo.save(personal());
    repo.save(personal({ systemId: 'nes', notes: undefined }));
    const summary = repo.summary();
    expect(summary.get('snes')).toEqual({ hasNotes: true, updatedAt: '2026-11-16T00:00:00.000Z' });
    expect(summary.get('nes')?.hasNotes).toBe(false);
  });

  it('FR-MUS-9: SystemInfoRepository.updatedAtById lists edited entries timestamps', () => {
    const info = new SystemInfoRepository(lib.db, () => new Date(Date.UTC(2026, 10, 15)));
    expect(info.updatedAtById().size).toBe(0);
    info.save({ systemId: 'snes', fullName: 'Super Nintendo' } as SystemInfo);
    expect(info.updatedAtById()).toEqual(new Map([['snes', '2026-11-15T00:00:00.000Z']]));
  });
});
