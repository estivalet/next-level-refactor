import {
  SettingsSchema,
  SYNC_SETTINGS_KEYS,
  type Settings,
  type SyncEntries,
} from '@nextlevel/shared';
import type { KindAdapter } from './documents.ts';
import { liveValue } from './merge.ts';

const ALLOWED = new Set<string>(SYNC_SETTINGS_KEYS);

function getPath(source: unknown, path: string): unknown {
  let current = source;
  for (const part of path.split('.')) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setPath<T>(source: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split('.');
  if (head === undefined) return source;
  const record = source as Record<string, unknown>;
  return {
    ...record,
    [head]: rest.length === 0 ? value : setPath(record[head] ?? {}, rest.join('.'), value),
  } as T;
}

export interface SettingsDocDeps {
  settings(): Settings;
  /** Main's settings write (SettingsService.update). */
  update(change: (settings: Settings) => Settings): Promise<void>;
  log: { warn(context: object, msg: string): void };
}

/**
 * The `settings` document (D55): only SYNC_SETTINGS_KEYS, one entry each. Anything else in a
 * document (paths, storage, emulators, kiosk, …) is never read here and never applied; a value
 * this launcher can't accept (a newer version's) is skipped.
 */
export function settingsDoc(deps: SettingsDocDeps): KindAdapter {
  return {
    read() {
      const settings = deps.settings();
      const values = new Map<string, unknown>(
        SYNC_SETTINGS_KEYS.map((key) => [key, getPath(settings, key)]),
      );
      return {
        view: { values, holds: (key) => ALLOWED.has(key), subject: () => null },
        present: (key) => ALLOWED.has(key),
        hasSubject: () => false,
      };
    },
    async apply(merged: SyncEntries, keys) {
      const allowed = keys.filter((key) => ALLOWED.has(key));
      if (allowed.length === 0) return;
      await deps.update((current) => {
        let next = current;
        for (const key of allowed) {
          const value = liveValue(merged[key]);
          if (value === undefined) continue;
          const candidate = SettingsSchema.safeParse(setPath(next, key, value));
          if (candidate.success) next = candidate.data;
          else deps.log.warn({ key }, 'a synced setting was not applied');
        }
        return next;
      });
    },
  };
}
