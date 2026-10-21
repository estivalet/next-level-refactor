import { CURRENT_SCHEMA_VERSION } from '@nextlevel/shared';

export type MigrateResult = { kind: 'ok'; value: unknown } | { kind: 'newerVersion' };

/**
 * Brings a parsed settings file up to the current schema version. Version 1 is the only version
 * so far; the first real migration adds its step here (with a backup first, data model §2.2).
 */
export function migrate(raw: unknown): MigrateResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    return { kind: 'ok', value: raw };
  const record = raw as Record<string, unknown>;
  const version = record['schemaVersion'] ?? CURRENT_SCHEMA_VERSION;
  if (typeof version === 'number' && version > CURRENT_SCHEMA_VERSION)
    return { kind: 'newerVersion' };
  return { kind: 'ok', value: { ...record, schemaVersion: version } };
}
