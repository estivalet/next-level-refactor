import { z } from 'zod';
import { EXTENSION, SYSTEM_ID } from '../catalog/schema.ts';
import { templateIssues } from '../launch/template.ts';

// Emulators and launch profiles (data model §2, FR-EMU-2, ADR-004). Templates are checked when
// saving, so an unknown token never reaches a launch (FR-EMU-3).

const ABSOLUTE_EXECUTABLE = /^([a-zA-Z]:[\\/]|\\\\[^\\]+\\).*\.(exe|bat|cmd)$/i;

function template(where: 'arg' | 'value' | 'entry') {
  return z
    .string()
    .max(1000)
    .superRefine((value, ctx) => {
      const issue = templateIssues(value, where)[0];
      if (issue) ctx.addIssue({ code: 'custom', message: issue.message, params: { ...issue } });
    });
}

export const EmulatorSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(60),
  /** The preset it was created from, if any (FR-EMU-7). */
  presetId: z.string().min(1).optional(),
  executable: z
    .string()
    .trim()
    .refine((path) => ABSOLUTE_EXECUTABLE.test(path), { message: 'notExecutable' }),
  version: z.string().trim().max(40).optional(),
});

export type Emulator = z.output<typeof EmulatorSchema>;

export const ARCHIVE_MODES = ['pass', 'extract'] as const;
export type ArchiveMode = (typeof ARCHIVE_MODES)[number];

/** FR-EMU-9: pass `.wsquashfs` images to the emulator, or mount them as a drive first. */
export const SQUASHFS_MODES = ['pass', 'mount'] as const;
export type SquashfsMode = (typeof SQUASHFS_MODES)[number];

/**
 * One "game files" rule (FR-EMU-9): when `file` exists (a `*` in its name matches any run of
 * characters), its `args` are rendered at `{entryArgs}`, with `{entry}` = the matched file.
 */
export const EntryRuleSchema = z.object({
  file: template('value'),
  args: z.array(template('entry')).min(1).max(8),
});

export type EntryRule = z.output<typeof EntryRuleSchema>;

export const EmulatorProfileSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(80),
  emulatorId: z.uuid(),
  systems: z.array(z.string().regex(SYSTEM_ID)).min(1),
  /** One template per argv element; `{extraArgs}` alone expands to the game's extra args. */
  args: z.array(template('arg')).max(64),
  /** Working directory template; default `{emulatorDir}`. */
  cwd: template('value').optional(),
  /** RetroArch core name, used by `{core}`. */
  core: z.string().trim().max(120).optional(),
  /** FR-EMU-8: pass archives to the emulator, or extract them to a temp folder first. */
  archives: z.enum(ARCHIVE_MODES).default('pass'),
  /** FR-EMU-9: mount `.wsquashfs` images before launching. */
  squashfs: z.enum(SQUASHFS_MODES).default('pass'),
  /** FR-EMU-9: rules tried in order; the first whose file exists fills `{entryArgs}`. */
  entries: z.array(EntryRuleSchema).max(16).default([]),
  /** FR-EMU-9: a file whose words are added before the game's extra args, when it exists. */
  argsFile: template('value').optional(),
  /**
   * FR-EMU-9: ROM files with these extensions point to the game (Xbox 360 `.m3u`, XBLA
   * `.xbox360`): their first line is the game's path inside the system folder, and that file is
   * launched as `{rom}`.
   */
  pointerExtensions: z.array(z.string().regex(EXTENSION)).max(8).default([]),
  env: z.record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/), template('value')).default({}),
  /** The preset profile it was created from, if any. */
  presetProfileId: z.string().min(1).optional(),
});

export type EmulatorProfile = z.output<typeof EmulatorProfileSchema>;

/** Cross-field checks for `SettingsSchema`: every profile names an existing emulator. */
export function checkProfiles(
  settings: { emulators: readonly Emulator[]; profiles: readonly EmulatorProfile[] },
  ctx: z.RefinementCtx,
): void {
  const emulatorIds = new Set(settings.emulators.map((emulator) => emulator.id));
  settings.profiles.forEach((profile, index) => {
    if (!emulatorIds.has(profile.emulatorId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['profiles', index, 'emulatorId'],
        message: 'unknownEmulator',
      });
    }
  });
}
