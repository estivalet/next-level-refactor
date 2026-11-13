import { z } from 'zod';

/**
 * What the updater is doing (NFR-UPD-1, D53). `unsupported`: a development build, or a zip copy
 * (no uninstaller beside the exe) that can't update itself; a zip copy still learns about a newer
 * release (`availableVersion`, `releaseUrl`) for its notice.
 */
export const UpdateStateSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('unsupported'),
    reason: z.enum(['dev', 'zip']),
    availableVersion: z.string().nullable(),
    releaseUrl: z.url().nullable(),
  }),
  z.object({ kind: z.literal('idle'), lastCheck: z.iso.datetime().nullable() }),
  z.object({ kind: z.literal('checking') }),
  z.object({
    kind: z.literal('downloading'),
    version: z.string(),
    percent: z.number().min(0).max(100),
  }),
  /** Downloaded; installs when NextLevel quits, or now with `update.restart`. */
  z.object({ kind: z.literal('ready'), version: z.string() }),
  z.object({ kind: z.literal('error'), code: z.enum(['network', 'signature', 'other']) }),
]);

export type UpdateState = z.output<typeof UpdateStateSchema>;

/** Update channels (D53). */
export const updateContract = {
  'update.state': { input: z.void(), output: UpdateStateSchema },
  /** Checks now (also with automatic checks off); answers the state after the check started. */
  'update.check': { input: z.void(), output: UpdateStateSchema },
  /** Quits and installs a downloaded update, then starts NextLevel again. */
  'update.restart': { input: z.void(), output: z.void() },
  /** Opens the release a zip copy found (or the releases page) in the browser. */
  'update.openRelease': { input: z.void(), output: z.void() },
} as const;

export const updateEvents = {
  'update.changed': UpdateStateSchema,
} as const;

/** The fields NextLevel reads from a GitHub release (zip copies' update notice). */
export const GitHubReleaseSchema = z.object({
  tag_name: z.string(),
  html_url: z.url(),
  draft: z.boolean(),
  prerelease: z.boolean(),
});
