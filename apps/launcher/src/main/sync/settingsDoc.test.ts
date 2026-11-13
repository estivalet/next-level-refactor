import { defaultSettings, type Settings, type SyncEntries } from '@nextlevel/shared';
import { describe, expect, it, vi } from 'vitest';
import { changedKeys } from './merge.ts';
import { settingsDoc } from './settingsDoc.ts';

const at = '2026-11-13T12:00:00.000Z';

function setup(start: Settings = defaultSettings()) {
  let current = start;
  const doc = settingsDoc({
    settings: () => current,
    update: (change) => {
      current = change(current);
      return Promise.resolve();
    },
    log: { warn: vi.fn() },
  });
  return { doc, current: () => current };
}

describe('settings document (FR-SET-5, D55)', () => {
  it('reads only the allow-list (language, themes, sounds, input, scraper preferences)', () => {
    const { doc } = setup();
    const keys = [...doc.read({}, {}).view.values.keys()];
    expect(keys).toContain('general.language');
    expect(keys).toContain('input');
    expect(
      keys.some((key) => /storage|emulators|profiles|systems|kiosk|sync|webTool/.test(key)),
    ).toBe(false);
  });

  it('settings apply ignores path keys (storage, emulators, assetsPath, …) even if present', async () => {
    const { doc, current } = setup();
    const merged: SyncEntries = {
      'general.language': { value: 'pt-BR', updatedAt: at },
      'storage.assetsPath': { value: 'D:\\Art', updatedAt: at },
      storage: { value: { locations: [] }, updatedAt: at },
      emulators: { value: [], updatedAt: at },
      'kiosk.enabled': { value: true, updatedAt: at },
      'scraper.gemini.webTool': { value: { python: 'C:\\py.exe' }, updatedAt: at },
    };
    const read = doc.read({}, merged);
    await doc.apply(merged, changedKeys({}, merged, read.view, read.present), read);
    expect(current().general.language).toBe('pt-BR');
    expect(current().storage.assetsPath).toBeNull();
    expect(current().kiosk.enabled).toBe(false);
    expect(current().scraper.gemini.webTool.python).toBe('');
  });

  it("a value this launcher can't accept is skipped; the others still apply", async () => {
    const { doc, current } = setup();
    const merged: SyncEntries = {
      'general.language': { value: 'xx', updatedAt: at },
      'themes.sound': { value: { enabled: false, volume: 20 }, updatedAt: at },
    };
    await doc.apply(merged, ['general.language', 'themes.sound'], doc.read({}, merged));
    expect(current().general.language).toBe('en');
    expect(current().themes.sound).toEqual({ enabled: false, volume: 20 });
  });
});
