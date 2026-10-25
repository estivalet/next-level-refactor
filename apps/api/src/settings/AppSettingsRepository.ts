import {
  AppSettingsSchema,
  defaultAppSettings,
  type AppSettings,
  type AppSettingsPatch,
} from '@nextlevel/shared';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { appSettings } from '../db/schema.ts';

// `app_settings` holds one row per AppSettings key (data model §5, FR-ADM-4).

type Db = BetterSQLite3Database<Record<string, unknown>>;
const KEYS = Object.keys(defaultAppSettings()) as Array<keyof AppSettings>;

/** Adds the default of every key that has no row yet. */
export function seedAppSettings(db: Db): void {
  const defaults = defaultAppSettings();
  db.insert(appSettings)
    .values(KEYS.map((key) => ({ key, value: defaults[key] })))
    .onConflictDoNothing()
    .run();
}

/** The current settings; a row that fails the schema falls back to the default for the whole set. */
export function loadAppSettings(db: Db): AppSettings {
  const rows = db.select().from(appSettings).all();
  const stored = Object.fromEntries(
    rows.filter((row) => (KEYS as string[]).includes(row.key)).map((row) => [row.key, row.value]),
  );
  const parsed = AppSettingsSchema.safeParse({ ...defaultAppSettings(), ...stored });
  return parsed.success ? parsed.data : defaultAppSettings();
}

/** Writes the given keys (already validated) and returns the whole set. */
export function saveAppSettings(db: Db, patch: AppSettingsPatch): AppSettings {
  const next = AppSettingsSchema.parse({ ...loadAppSettings(db), ...patch });
  db.transaction((tx) => {
    for (const key of Object.keys(patch) as Array<keyof AppSettings>) {
      tx.insert(appSettings)
        .values({ key, value: next[key] })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: next[key] } })
        .run();
    }
  });
  return next;
}
