import { z } from 'zod';
import { SettingsSchema } from '../settings/schema.ts';

/** The saved settings with the in-memory revision that stale saves are checked against. */
export const SettingsSnapshotSchema = z.object({
  settings: SettingsSchema,
  revision: z.number().int(),
});

export type SettingsSnapshot = z.output<typeof SettingsSnapshotSchema>;
