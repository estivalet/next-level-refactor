import { z } from 'zod';
import { SYSTEM_ID } from '../catalog/schema.ts';
import { templateIssues } from '../launch/template.ts';

// Emulators and launch profiles (data model §2, FR-EMU-2, ADR-004). Templates are checked when
// saving, so an unknown token never reaches a launch (FR-EMU-3).

const ABSOLUTE_EXECUTABLE = /^([a-zA-Z]:[\\/]|\\\\[^\\]+\\).*\.(exe|bat|cmd)$/i;

function template(where: 'arg' | 'value') {
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
