import { z } from 'zod';
import { AppErrorSchema } from '../errors.ts';

/** Limits of a game's launch options, shared with the Launch options dialog. */
export const LAUNCH_OVERRIDE_LIMITS = { core: 120, extraArgs: 50, extraArg: 1000 } as const;

/** A game's own launch settings (FR-EMU-4); empty fields fall back to the system's profile. */
export const LaunchOverrideSchema = z.object({
  profileId: z.uuid().nullable(),
  core: z.string().trim().max(LAUNCH_OVERRIDE_LIMITS.core).nullable(),
  /** Extra argv elements, inserted where the profile has `{extraArgs}`. */
  extraArgs: z
    .array(z.string().max(LAUNCH_OVERRIDE_LIMITS.extraArg))
    .max(LAUNCH_OVERRIDE_LIMITS.extraArgs),
});

export type LaunchOverride = z.output<typeof LaunchOverrideSchema>;

export const EMPTY_LAUNCH_OVERRIDE: LaunchOverride = { profileId: null, core: null, extraArgs: [] };

/** The Settings section (and item) that fixes a launch error (IA: errors link to their fix). */
export const LaunchFixSchema = z.object({
  section: z.enum(['emulators', 'systems', 'storage']),
  id: z.string().optional(),
});

export type LaunchFix = z.output<typeof LaunchFixSchema>;

/** `AppError.details` of launch errors (US-C2): what failed, why, and where to fix it. */
export const LaunchErrorDetailsSchema = z.object({
  fix: LaunchFixSchema.optional(),
  path: z.string().optional(),
  stderrTail: z.string().optional(),
  exitCode: z.number().int().optional(),
  /** A short machine reason, e.g. the spawn error code (ENOENT) or `cwdMissing`. */
  reason: z.string().optional(),
});

export type LaunchErrorDetails = z.output<typeof LaunchErrorDetailsSchema>;

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

/** A rendered command without launching it (FR-EMU-5 live preview). */
export const LaunchPreviewSchema = z.object({
  executable: z.string(),
  args: z.array(z.string()),
  cwd: z.string(),
  /** For display only; launches always pass the argv array (ADR-004). */
  commandLine: z.string(),
});

export type LaunchPreview = z.output<typeof LaunchPreviewSchema>;

/** What a Test launch shows: the exact command, exit code and stderr (FR-EMU-5). */
export const TestLaunchResultSchema = LaunchPreviewSchema.extend({
  exitCode: z.number().int().nullable(),
  stderrTail: z.string(),
  durationMs: z.number().int().min(0),
  /** Set when the emulator could not be found or started. */
  error: AppErrorSchema.optional(),
});

export type TestLaunchResult = z.output<typeof TestLaunchResultSchema>;

export const LaunchStartedSchema = z.object({
  launchId: z.number().int().positive(),
  gameId: z.number().int().positive(),
});

export const LaunchFinishedSchema = LaunchStartedSchema.extend({
  exitCode: z.number().int().nullable(),
  durationMs: z.number().int().min(0),
  /** Whether it counted as a play (owner decision D5). */
  counted: z.boolean(),
  /** Set when the run failed: an exit code other than 0 within 10 seconds. */
  error: AppErrorSchema.optional(),
});

export type LaunchFinished = z.output<typeof LaunchFinishedSchema>;
