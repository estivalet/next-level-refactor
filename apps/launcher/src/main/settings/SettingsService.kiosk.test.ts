import { defaultSettings, type Settings } from '@nextlevel/shared';
import { writeFile } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { SettingsService } from './SettingsService.ts';
import { settingsFixture } from './testing.ts';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

const KIOSK_ON: Settings['kiosk'] = {
  enabled: true,
  pinHash: 'scrypt$16384$c2FsdA==$aGFzaA==',
  hide: ['settings'],
};

async function setup(importFile?: string) {
  const fixture = await settingsFixture();
  cleanups.push(fixture.cleanup);
  const service = new SettingsService({
    ...fixture.deps,
    dialogs: { ...fixture.deps.dialogs, pickImportPath: () => Promise.resolve(importFile ?? null) },
  });
  await service.load();
  const updated = await service.update((settings) => ({ ...settings, kiosk: KIOSK_ON }));
  if (!updated.ok) throw new Error(updated.error.code);
  return { service, dir: fixture.dir };
}

const kioskOf = (service: SettingsService) => {
  const state = service.get();
  if (state.kind !== 'ok') throw new Error('not ok');
  return state.snapshot.settings.kiosk;
};

describe('the kiosk section is main-owned (FR-SET-6, Review Focus 3)', () => {
  it('a settings save cannot turn kiosk off or change its PIN; main updates can', async () => {
    const { service } = await setup();
    const state = service.get();
    if (state.kind !== 'ok') throw new Error('not ok');
    const attempt = {
      ...state.snapshot.settings,
      kiosk: { enabled: false, pinHash: null, hide: [] },
    };
    const saved = await service.save(attempt, state.snapshot.revision);
    expect(saved.ok).toBe(true);
    expect(kioskOf(service)).toEqual(KIOSK_ON);
  });

  it('reset, restore and import keep the kiosk section too', async () => {
    const fixture = await settingsFixture();
    cleanups.push(fixture.cleanup);
    const file = `${fixture.dir}/import.json`;
    await writeFile(file, JSON.stringify({ ...defaultSettings(), kiosk: { enabled: false } }));
    const { service } = await setup(file);
    await service.reset();
    expect(kioskOf(service)).toEqual(KIOSK_ON);
    const imported = await service.importFrom();
    expect(imported.ok).toBe(true);
    expect(kioskOf(service)).toEqual(KIOSK_ON);
    const [backup] = await service.listBackups();
    if (!backup) throw new Error('no backup');
    await service.restore(backup.id);
    expect(kioskOf(service)).toEqual(KIOSK_ON);
  });
});
