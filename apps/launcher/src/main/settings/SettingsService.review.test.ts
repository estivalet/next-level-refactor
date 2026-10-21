import { defaultSettings, type Settings } from '@nextlevel/shared';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SettingsService } from './SettingsService.ts';
import { settingsFixture } from './testing.ts';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

async function setup(fileContent?: string) {
  const fixture = await settingsFixture();
  cleanups.push(fixture.cleanup);
  const file = join(fixture.dir, 'settings.json');
  if (fileContent !== undefined) await writeFile(file, fileContent);
  return { service: new SettingsService(fixture.deps), file, dir: fixture.dir };
}

function withLanguage(language: Settings['general']['language']): Settings {
  const settings = defaultSettings();
  return { ...settings, general: { ...settings.general, language } };
}

describe('SettingsService under concurrent writes (NFR-REL-1)', () => {
  it('two saves from the same revision: one wins, the other gets CONFLICT', async () => {
    const { service, file } = await setup();
    await service.load();
    const results = await Promise.all([
      service.save(withLanguage('pt-BR'), 0),
      service.save(withLanguage('en'), 0),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.error.code === 'CONFLICT')).toHaveLength(1);
    const winner = results.find((r) => r.ok);
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(
      winner?.ok ? winner.value.settings : null,
    );
  });

  it('a save racing a reset ends with a complete file matching the final state', async () => {
    const { service, file } = await setup();
    await service.load();
    await Promise.all([service.save(withLanguage('pt-BR'), 0), service.reset()]);
    const state = service.get();
    if (state.kind !== 'ok') throw new Error('not ok');
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(state.snapshot.settings);
    expect(state.snapshot.revision).toBe(2);
  });
});

describe('SettingsService loading edge cases', () => {
  it('FR-SET-2: a UTF-8 BOM (Notepad, PowerShell 5) is accepted', async () => {
    const { service } = await setup('﻿{"schemaVersion":1,"general":{"language":"pt-BR"}}');
    expect(await service.load()).toMatchObject({
      kind: 'ok',
      snapshot: { settings: withLanguage('pt-BR') },
    });
  });

  it('a settings path that cannot be read loads as invalid instead of throwing', async () => {
    const { service, file } = await setup();
    await mkdir(file);
    expect(await service.load()).toMatchObject({ kind: 'invalid', reason: 'unreadable' });
  });

  it('US-D3: latestBackupId skips backups that are themselves unusable', async () => {
    const { service, file, dir } = await setup();
    await service.load();
    await service.save(withLanguage('pt-BR'), 0);
    await service.save(withLanguage('en'), 1); // backup 1 = pt-BR (valid)
    await writeFile(file, 'broken');
    await service.load();
    await service.reset(); // backup 2 = 'broken'
    await writeFile(file, 'broken again');
    const load = await service.load();
    const backups = (await readdir(join(dir, 'backups'))).sort();
    expect(backups).toHaveLength(2);
    expect(load).toEqual({ kind: 'invalid', reason: 'unreadable', latestBackupId: backups[0] });
  });
});
