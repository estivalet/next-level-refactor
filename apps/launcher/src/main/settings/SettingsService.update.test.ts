import { defaultSettings, type SettingsSnapshot } from '@nextlevel/shared';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SettingsService } from './SettingsService.ts';
import { settingsFixture } from './testing.ts';

let cleanup: () => Promise<void> = () => Promise.resolve();
afterEach(() => cleanup());

describe('SettingsService.update', () => {
  it('FR-SET-1: update applies to the latest settings and notifies onChanged', async () => {
    const changes: SettingsSnapshot[] = [];
    const fixture = await settingsFixture({ onChanged: (snapshot) => changes.push(snapshot) });
    cleanup = fixture.cleanup;
    const service = new SettingsService(fixture.deps);
    await service.load();
    const saved = await service.save(
      { ...defaultSettings(), systems: { 'nintendo-64': { enabled: false } } },
      0,
    );
    expect(saved.ok).toBe(true);

    const result = await service.update((settings) => ({
      ...settings,
      systems: { ...settings.systems, 'sega-genesis': { enabled: true } },
    }));

    if (!result.ok) throw new Error(result.error.code);
    expect(result.value.revision).toBe(2);
    expect(result.value.settings.systems).toEqual({
      'nintendo-64': { enabled: false },
      'sega-genesis': { enabled: true },
    });
    expect(changes.map((change) => change.revision)).toEqual([1, 2]);
    const file = JSON.parse(await readFile(join(fixture.dir, 'settings.json'), 'utf8')) as {
      systems: unknown;
    };
    expect(file.systems).toEqual(result.value.settings.systems);
  });

  it('FR-SET-1: update rejects a change that breaks the schema', async () => {
    const fixture = await settingsFixture();
    cleanup = fixture.cleanup;
    const service = new SettingsService(fixture.deps);
    await service.load();
    const result = await service.update((settings) => ({
      ...settings,
      systems: { bad: { enabled: true, extensions: ['.ZIP'] } },
    }));
    expect(result.ok ? null : result.error.code).toBe('INVALID_SETTINGS');
  });
});
