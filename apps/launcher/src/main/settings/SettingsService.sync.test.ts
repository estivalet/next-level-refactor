import { defaultSettings, type Settings } from '@nextlevel/shared';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SettingsService } from './SettingsService.ts';
import { settingsFixture } from './testing.ts';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

const SYNC_ON: Settings['sync'] = {
  enabled: true,
  deviceKey: '0195b2a4-6f1e-7c3d-8a9b-0c1d2e3f4a5b',
  deviceHost: '0123456789abcdef',
};

describe('the sync section is main-owned (FR-SET-5, D55)', () => {
  it('save, reset and import keep sync as it is, so two PCs never share a device key', async () => {
    const fixture = await settingsFixture();
    cleanups.push(fixture.cleanup);
    const other = join(fixture.dir, 'other-pc.json');
    const service = new SettingsService({
      ...fixture.deps,
      dialogs: { ...fixture.deps.dialogs, pickImportPath: () => Promise.resolve(other) },
    });
    await service.load();
    const updated = await service.update((settings) => ({ ...settings, sync: SYNC_ON }));
    if (!updated.ok) throw new Error(updated.error.code);
    const saved = await service.save(
      { ...defaultSettings(), sync: { enabled: false, deviceKey: null, deviceHost: null } },
      updated.value.revision,
    );
    expect(saved.ok && saved.value.settings.sync).toEqual(SYNC_ON);
    expect((await service.reset()).settings.sync).toEqual(SYNC_ON);
    await writeFile(
      other,
      JSON.stringify({
        ...defaultSettings(),
        sync: { enabled: true, deviceKey: '0195b2a4-0000-7000-8000-000000000000' },
      }),
    );
    const imported = await service.importFrom();
    expect(
      imported.ok && imported.value.status === 'imported' && imported.value.snapshot.settings.sync,
    ).toEqual(SYNC_ON);
  });
});
