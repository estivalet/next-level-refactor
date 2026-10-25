import { defaultSettings, type Settings } from '@nextlevel/shared';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SettingsService, type SettingsDeps } from './SettingsService.ts';
import { settingsFixture } from './testing.ts';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

async function newFixture() {
  const created = await settingsFixture();
  cleanups.push(created.cleanup);
  return created;
}

async function setup(dialogs?: Partial<SettingsDeps['dialogs']>) {
  const fixture = await newFixture();
  const deps = { ...fixture.deps, dialogs: { ...fixture.deps.dialogs, ...dialogs } };
  const service = new SettingsService(deps);
  await service.load();
  return { service, dir: fixture.dir };
}

function settingsWith(general: Partial<Settings['general']>): Settings {
  const settings = defaultSettings();
  return { ...settings, general: { ...settings.general, ...general } };
}

async function saveOk(service: SettingsService, settings: Settings) {
  const current = service.get();
  if (current.kind !== 'ok') throw new Error('not ok');
  const result = await service.save(settings, current.snapshot.revision);
  if (!result.ok) throw new Error(result.error.code);
}

function current(service: SettingsService): Settings {
  const state = service.get();
  if (state.kind !== 'ok') throw new Error('not ok');
  return state.snapshot.settings;
}

describe('SettingsService backups', () => {
  it('US-D3: after 3 saves Backups lists 2 entries newest first with what changed', async () => {
    const { service } = await setup();
    await saveOk(service, settingsWith({ language: 'pt-BR' }));
    await saveOk(service, settingsWith({ language: 'en' }));
    await saveOk(service, settingsWith({ language: 'en', startWithWindows: true }));

    const list = await service.listBackups();
    expect(list.map((b) => b.createdAt)).toEqual([
      '2026-10-21T12:00:02.000Z',
      '2026-10-21T12:00:01.000Z',
    ]);
    expect(list[0]?.changes).toEqual(['general.startWithWindows']);
    expect(list[1]?.changes).toEqual(['general.language']);
    expect(list[0]?.size).toBeGreaterThan(0);
  });

  it('US-D3: restoring backs up the current state first', async () => {
    const { service, dir } = await setup();
    await saveOk(service, settingsWith({ language: 'pt-BR' }));
    await saveOk(service, settingsWith({ language: 'en' }));
    const [backup] = await service.listBackups();

    const result = await service.restore(backup?.id ?? '');
    expect(result.ok).toBe(true);
    expect(current(service).general.language).toBe('pt-BR');
    expect(await readdir(join(dir, 'backups'))).toHaveLength(2);
  });

  it('restore with 10 backups restores the oldest even though it is pruned', async () => {
    const { service } = await setup();
    for (let i = 0; i < 11; i += 1) {
      await saveOk(service, settingsWith({ startWithWindows: i % 2 === 0 }));
    }
    const list = await service.listBackups();
    expect(list).toHaveLength(10);
    const oldest = list.at(-1);
    const oldestSettings = JSON.parse(
      await readFile(join(service.paths.backups, oldest?.id ?? ''), 'utf8'),
    ) as Settings;

    const result = await service.restore(oldest?.id ?? '');
    expect(result.ok).toBe(true);
    expect(current(service)).toEqual(oldestSettings);
  });

  it('restore of an unknown or ../ id returns NOT_FOUND', async () => {
    const { service } = await setup();
    await saveOk(service, settingsWith({ language: 'pt-BR' }));
    await saveOk(service, settingsWith({ language: 'en' }));
    for (const id of ['nope.json', '../settings.json']) {
      expect(await service.restore(id)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    }
  });

  it('US-D3: restore works from the invalid state', async () => {
    const { service } = await setup();
    await saveOk(service, settingsWith({ language: 'pt-BR' }));
    await saveOk(service, settingsWith({ language: 'en' }));
    await writeFile(service.paths.settings, 'broken');
    const load = await service.load();
    if (load.kind !== 'invalid' || !load.latestBackupId) throw new Error('expected invalid');
    expect((await service.restore(load.latestBackupId)).ok).toBe(true);
    expect(current(service).general.language).toBe('pt-BR');
  });
});

describe('SettingsService export and import', () => {
  it('FR-SET-4: export then import round-trips', async () => {
    const { dir } = await newFixture();
    const exportFile = join(dir, 'export.json');
    const exporter = await setup({ pickExportPath: () => Promise.resolve(exportFile) });
    await saveOk(exporter.service, settingsWith({ language: 'pt-BR', startWithWindows: true }));
    expect(await exporter.service.exportTo()).toEqual({ ok: true, value: { status: 'saved' } });

    const importer = await setup({ pickImportPath: () => Promise.resolve(exportFile) });
    const result = await importer.service.importFrom();
    expect(result).toMatchObject({ ok: true, value: { status: 'imported' } });
    expect(current(importer.service)).toEqual(
      settingsWith({ language: 'pt-BR', startWithWindows: true }),
    );
  });

  it.each([
    ['not JSON', 'nope'],
    ['a newer version', '{"schemaVersion":7}'],
    ['a wrong type', '{"schemaVersion":1,"general":{"startWithWindows":"yes"}}'],
    ['a file over 1 MB', `{"schemaVersion":1,"pad":"${'x'.repeat(1024 * 1024)}"}`],
  ])('FR-SET-4: import rejects %s with INVALID_SETTINGS', async (_label, content) => {
    const fixture = await newFixture();
    const file = join(fixture.dir, 'import.json');
    await writeFile(file, content);
    const { service } = await setup({ pickImportPath: () => Promise.resolve(file) });
    const before = current(service);
    expect(await service.importFrom()).toMatchObject({
      ok: false,
      error: { code: 'INVALID_SETTINGS' },
    });
    expect(current(service)).toEqual(before);
  });

  it('import cancelled returns cancelled and writes nothing', async () => {
    const { service, dir } = await setup();
    expect(await service.importFrom()).toEqual({ ok: true, value: { status: 'cancelled' } });
    expect(await readdir(dir)).toEqual([]);
  });

  it('export cancelled returns cancelled', async () => {
    const { service } = await setup();
    expect(await service.exportTo()).toEqual({ ok: true, value: { status: 'cancelled' } });
  });

  it('a v1 file is migrated on load and its exact bytes are backed up at the next save (D16)', async () => {
    const fixture = await newFixture();
    const v1 = JSON.stringify({
      schemaVersion: 1,
      themes: { entries: { 'big-box': { art: { gameArt: { all: ['screenshot-title'] } } } } },
    });
    await writeFile(join(fixture.dir, 'settings.json'), v1);
    const service = new SettingsService(fixture.deps);
    await service.load();
    expect(current(service).themes.entries['big-box']?.art?.gameArt).toEqual({
      all: ['screenshot-game-title'],
    });
    await saveOk(service, current(service));
    const backups = await readdir(join(fixture.dir, 'backups'));
    expect(backups).toHaveLength(1);
    expect(await readFile(join(fixture.dir, 'backups', backups[0] ?? ''), 'utf8')).toBe(v1);
    const saved = JSON.parse(await readFile(join(fixture.dir, 'settings.json'), 'utf8')) as {
      schemaVersion: number;
    };
    expect(saved.schemaVersion).toBe(2);
  });
});
