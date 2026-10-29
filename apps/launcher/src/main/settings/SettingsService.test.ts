import { defaultSettings, type Settings } from '@nextlevel/shared';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SettingsService } from './SettingsService.ts';
import { settingsFixture } from './testing.ts';

let cleanup: () => Promise<void> = () => Promise.resolve();
afterEach(() => cleanup());

async function setup(fileContent?: string) {
  const fixture = await settingsFixture();
  cleanup = fixture.cleanup;
  const file = join(fixture.dir, 'settings.json');
  if (fileContent !== undefined) await writeFile(file, fileContent);
  const service = new SettingsService(fixture.deps);
  return { service, file, dir: fixture.dir };
}

const backups = async (dir: string) =>
  (await readdir(join(dir, 'backups')).catch(() => [] as string[])).sort();

function withLanguage(language: Settings['general']['language']): Settings {
  const settings = defaultSettings();
  return { ...settings, general: { ...settings.general, language } };
}

async function saveOk(service: SettingsService, settings: Settings) {
  const current = service.get();
  if (current.kind !== 'ok') throw new Error('not ok');
  const result = await service.save(settings, current.snapshot.revision);
  if (!result.ok) throw new Error(`${result.error.code} ${JSON.stringify(result.error.details)}`);
  return result.value;
}

describe('SettingsService', () => {
  it('FR-SET-2: missing file loads defaults without writing', async () => {
    const { service, dir } = await setup();
    expect(await service.load()).toEqual({
      kind: 'ok',
      snapshot: { settings: defaultSettings(), revision: 0 },
    });
    expect(await readdir(dir)).toEqual([]);
  });

  it('FR-SET-2: invalid JSON loads as invalid/unreadable and the file is untouched', async () => {
    const { service, file } = await setup('{ not json');
    expect(await service.load()).toEqual({
      kind: 'invalid',
      reason: 'unreadable',
      latestBackupId: null,
    });
    expect(await readFile(file, 'utf8')).toBe('{ not json');
  });

  it('FR-SET-2: a wrong type loads as invalid/invalid', async () => {
    const { service } = await setup('{"schemaVersion":1,"general":{"language":42}}');
    expect(await service.load()).toMatchObject({ kind: 'invalid', reason: 'invalid' });
  });

  it('schemaVersion 99 loads as invalid/newerVersion', async () => {
    const { service } = await setup('{"schemaVersion":99}');
    expect(await service.load()).toMatchObject({ kind: 'invalid', reason: 'newerVersion' });
  });

  it('loads a valid file with unknown keys stripped', async () => {
    const { service } = await setup('{"schemaVersion":1,"general":{"language":"pt-BR","x":1}}');
    expect(await service.load()).toEqual({
      kind: 'ok',
      snapshot: { settings: withLanguage('pt-BR'), revision: 0 },
    });
  });

  it('FR-SET-2: save rejects invalid settings and writes nothing', async () => {
    const { service, dir } = await setup();
    await service.load();
    const bad = { schemaVersion: 1, general: { language: 'xx' } } as unknown as Settings;
    const result = await service.save(bad, 0);
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_SETTINGS' } });
    expect(await readdir(dir)).toEqual([]);
  });

  it('FR-SET-1: save writes the file and bumps the revision', async () => {
    const { service, file } = await setup();
    await service.load();
    const snapshot = await saveOk(service, withLanguage('pt-BR'));
    expect(snapshot.revision).toBe(1);
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(withLanguage('pt-BR'));
  });

  it('D45: saving a new Catalog folder path keeps the old one as an ordinary location', async () => {
    const { service } = await setup();
    await service.load();
    const settings = defaultSettings();
    const managed = {
      id: '0192f000-0000-7000-8000-000000000002',
      name: 'Catalog',
      path: 'E:\\NextLevel\\Catalog',
      priority: 1,
      managed: true,
    };
    const first = await saveOk(service, {
      ...settings,
      storage: { ...settings.storage, locations: [managed] },
    });
    const moved = await saveOk(service, {
      ...first.settings,
      storage: { ...first.settings.storage, locations: [{ ...managed, path: 'F:\\Catalog' }] },
    });
    const locations = moved.settings.storage.locations;
    expect(locations.map((l) => [l.name, l.path, l.managed])).toEqual([
      ['Catalog (old)', 'E:\\NextLevel\\Catalog', false],
      ['Catalog', 'F:\\Catalog', true],
    ]);
    expect(locations[0]?.id).toBe(managed.id);
    expect(locations[1]?.id).not.toBe(managed.id);
  });

  it('save with a stale revision returns CONFLICT', async () => {
    const { service } = await setup();
    await service.load();
    await saveOk(service, withLanguage('pt-BR'));
    const result = await service.save(withLanguage('en'), 0);
    expect(result).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
  });

  it('FR-SET-3: each save backs up the previous file', async () => {
    const { service, dir } = await setup();
    await service.load();
    for (const language of ['pt-BR', 'en', 'pt-BR'] as const) {
      await saveOk(service, withLanguage(language));
    }
    expect(await backups(dir)).toHaveLength(2);
  });

  it('FR-SET-3: only the newest 10 backups are kept', async () => {
    const { service, dir } = await setup();
    await service.load();
    for (let i = 0; i < 13; i += 1) await saveOk(service, withLanguage(i % 2 ? 'en' : 'pt-BR'));
    const kept = await backups(dir);
    expect(kept).toHaveLength(10);
    expect(kept[0]).toBe('settings-2026-10-21T12-00-03-000Z.json');
  });

  it('save is refused while the file is invalid; reset backs up the bad file and writes defaults', async () => {
    const { service, file, dir } = await setup('{ not json');
    await service.load();
    expect(await service.save(defaultSettings(), 0)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_SETTINGS' },
    });
    const snapshot = await service.reset();
    expect(snapshot).toEqual({ settings: defaultSettings(), revision: 1 });
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(defaultSettings());
    const [backup] = await backups(dir);
    expect(await readFile(join(dir, 'backups', backup ?? ''), 'utf8')).toBe('{ not json');
  });

  it('latestBackupId is reported when invalid', async () => {
    const { service, file } = await setup();
    await service.load();
    await saveOk(service, withLanguage('pt-BR'));
    await saveOk(service, withLanguage('en'));
    await writeFile(file, 'broken');
    expect(await service.load()).toEqual({
      kind: 'invalid',
      reason: 'unreadable',
      latestBackupId: 'settings-2026-10-21T12-00-01-000Z.json',
    });
  });
});

describe('a moved NextLevel folder (D50, Review Focus 5)', () => {
  function rooted(lastRoot: string | null): Settings {
    const settings = defaultSettings();
    return {
      ...settings,
      general: { ...settings.general, lastRoot },
      storage: {
        ...settings.storage,
        locations: [
          {
            id: '01a18273-adc6-74f5-84e4-af4637b87ce2',
            name: 'Catalog',
            path: 'E:\\NextLevel\\Catalog',
            priority: 1,
          },
        ],
      },
    };
  }

  it('a different lastRoot rewrites paths after a backup and stores the new root', async () => {
    const { service, file, dir } = await setup(JSON.stringify(rooted('E:\\NextLevel')));
    await service.load();
    expect(await service.adoptRoot('F:\\NextLevel')).toEqual({
      movedFrom: 'E:\\NextLevel',
      changed: 1,
    });
    const saved = JSON.parse(await readFile(file, 'utf8')) as Settings;
    expect(saved.general.lastRoot).toBe('F:\\NextLevel');
    expect(saved.storage.locations[0]?.path).toBe('F:\\NextLevel\\Catalog');
    expect(await backups(dir)).toHaveLength(1);
  });

  it('the same root changes nothing and writes nothing', async () => {
    const { service, file, dir } = await setup(JSON.stringify(rooted('E:\\NextLevel')));
    await service.load();
    const before = await readFile(file, 'utf8');
    expect(await service.adoptRoot('e:\\nextlevel\\')).toEqual({ movedFrom: null, changed: 0 });
    expect(await readFile(file, 'utf8')).toBe(before);
    expect(await backups(dir)).toEqual([]);
  });

  it('a first portable boot records the root and moves nothing', async () => {
    const { service, file } = await setup(JSON.stringify(rooted(null)));
    await service.load();
    expect(await service.adoptRoot('F:\\NextLevel')).toEqual({ movedFrom: null, changed: 0 });
    const saved = JSON.parse(await readFile(file, 'utf8')) as Settings;
    expect(saved.general.lastRoot).toBe('F:\\NextLevel');
    expect(saved.storage.locations[0]?.path).toBe('E:\\NextLevel\\Catalog');
  });
  it('a relocation that cannot be written is logged and never stops the boot', async () => {
    const warnings: string[] = [];
    const fixture = await settingsFixture({ log: { warn: (_context, msg) => warnings.push(msg) } });
    cleanup = fixture.cleanup;
    await writeFile(join(fixture.dir, 'settings.json'), JSON.stringify(rooted('E:\\NextLevel')));
    class FailingWrite extends SettingsService {
      protected override write(): Promise<never> {
        return Promise.reject(Object.assign(new Error('read-only'), { code: 'EPERM' }));
      }
    }
    const service = new FailingWrite(fixture.deps);
    await service.load();
    expect(await service.adoptRoot('F:\\NextLevel')).toEqual({ movedFrom: null, changed: 0 });
    expect(warnings).toContain('settings paths could not follow the moved folder');
  });
});
