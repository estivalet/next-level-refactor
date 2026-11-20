import { z } from 'zod';

// Per-system scan exclusions (FR-LIB-15, US-D8). No system has a default; the scan adds them to
// the catalog's own walk rules. A pattern is one file or folder name with `*` wildcards; a folder
// is a path relative to the system's ROM folder, with `/` separators, so it applies in every
// storage location.

export const SCAN_EXCLUSIONS_MAX = 100;

/** One name: no path separators or characters Windows forbids, apart from the `*` wildcard. */
const PATTERN = /^[^<>:"/\\|?]+$/;
/** One folder name: what Windows allows, not `.` or `..`, not ending in a space or dot. */
const SEGMENT = /^[^<>:"/\\|?*]*[^<>:"/\\|?*. ]$/;

export function isRelativeFolder(path: string): boolean {
  return path.length > 0 && path.split('/').every((segment) => SEGMENT.test(segment));
}

export const ScanExclusionSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('pattern'),
    pattern: z.string().trim().min(1).max(200).regex(PATTERN),
  }),
  z.strictObject({
    kind: z.literal('folder'),
    path: z.string().trim().max(400).refine(isRelativeFolder, { message: 'notInSystemFolder' }),
  }),
]);

export type ScanExclusion = z.output<typeof ScanExclusionSchema>;

const keyOf = (exclusion: ScanExclusion) =>
  `${exclusion.kind}:${(exclusion.kind === 'pattern' ? exclusion.pattern : exclusion.path)
    .trim()
    .toLowerCase()}`;

/** Whether the list already holds this entry (same kind, same text ignoring case and spaces). */
export function hasExclusion(list: readonly ScanExclusion[], entry: ScanExclusion): boolean {
  const key = keyOf(entry);
  return list.some((item) => keyOf(item) === key);
}

export const ScanExclusionsSchema = z
  .array(ScanExclusionSchema)
  .max(SCAN_EXCLUSIONS_MAX)
  .superRefine((list, ctx) => {
    const seen = new Set<string>();
    list.forEach((entry, index) => {
      const key = keyOf(entry);
      if (seen.has(key)) {
        ctx.addIssue({ code: 'custom', path: [index], message: 'duplicateExclusion' });
      }
      seen.add(key);
    });
  });

/** Backslashes, no trailing separator. */
const cleanPath = (path: string) => path.trim().replace(/\//g, '\\').replace(/\\+$/, '');

/** The system's ROM folder in each storage location, in priority order. */
export function systemFolders(
  locations: ReadonlyArray<{ path: string; priority: number }>,
  folderName: string,
): string[] {
  return [...locations]
    .sort((a, b) => a.priority - b.priority)
    .map((location) => `${cleanPath(location.path)}\\${folderName}`);
}

/**
 * A folder picked in the dialog as an exclusion: its path inside the first system folder holding
 * it (case ignored), with `/` separators; null outside every system folder or for the folder
 * itself.
 */
export function exclusionFolderOf(picked: string, systemDirs: readonly string[]): string | null {
  const path = cleanPath(picked);
  for (const dir of systemDirs) {
    const prefix = `${cleanPath(dir)}\\`.toLowerCase();
    if (path.toLowerCase().startsWith(prefix)) {
      const relative = path.slice(prefix.length).split('\\').join('/');
      return isRelativeFolder(relative) ? relative : null;
    }
  }
  return null;
}
