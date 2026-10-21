import { z } from 'zod';

/** A game's own launch settings (FR-EMU-4); empty fields fall back to the system's profile. */
export const LaunchOverrideSchema = z.object({
  profileId: z.uuid().nullable(),
  core: z.string().trim().max(120).nullable(),
  /** Extra argv elements, inserted where the profile has `{extraArgs}`. */
  extraArgs: z.array(z.string().max(1000)).max(50),
});

export type LaunchOverride = z.output<typeof LaunchOverrideSchema>;

export const EMPTY_LAUNCH_OVERRIDE: LaunchOverride = { profileId: null, core: null, extraArgs: [] };

/** One row of the launch log (FR-EMU-10). Names are copies, so the log survives renames. */
export const LaunchLogEntrySchema = z.object({
  id: z.number().int().positive(),
  gameId: z.number().int().positive().nullable(),
  gameTitle: z.string(),
  profileId: z.string(),
  profileName: z.string(),
  /** Executable first, then the arguments exactly as passed to spawn. */
  argv: z.array(z.string()).min(1),
  cwd: z.string(),
  /** A Test launch from Settings (never counted as a play). */
  test: z.boolean(),
  startedAt: z.string(),
  /** null while running, or when the launcher quit before the emulator did. */
  endedAt: z.string().nullable(),
  exitCode: z.number().int().nullable(),
  errorCode: z.string().nullable(),
  stderrTail: z.string().nullable(),
});

export type LaunchLogEntry = z.output<typeof LaunchLogEntrySchema>;

export const LaunchLogPageSchema = z.object({
  total: z.number().int().min(0),
  offset: z.number().int().min(0),
  entries: z.array(LaunchLogEntrySchema),
});

export type LaunchLogPage = z.output<typeof LaunchLogPageSchema>;
