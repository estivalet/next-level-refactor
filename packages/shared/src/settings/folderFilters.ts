import { z } from 'zod';
import { filterSlug } from '../library/games.ts';

// Folder filters (FR-LIB-18, US-C12): the folders a game sits in name its filters, as NextLevelOS
// derived them (`inferFilterFromPath`). Worked out from the path the library holds, so changing
// these settings needs no rescan.

export const FOLDER_FILTER_PREFIXES = ['!', '+', '#'] as const;
export type FolderFilterPrefix = (typeof FOLDER_FILTER_PREFIXES)[number];
export const FOLDER_FILTER_RENAMES_MAX = 100;
/** Prefixed folders a game can sit in: the scan walks group folders 10 levels deep. */
const FOLDER_FILTERS_MAX = 10;

const filterName = z
  .string()
  .trim()
  .max(80)
  .refine((name) => filterSlug(name) !== null, { message: 'notAFilterName' });

export const FolderFilterRenameSchema = z.strictObject({
  /** A folder name as written, prefix included or not (`! Homebrews` or `Homebrews`). */
  folder: z.string().trim().min(1).max(200),
  filter: filterName,
});

/** A folder name without prefixes or spaces, lower case: what renames match on. */
const folderKey = (name: string) =>
  name
    .replace(/^[!+#\s]+/, '')
    .trim()
    .toLowerCase();

export const FolderFiltersSchema = z.object({
  /** Folder names starting with one of these add a filter; none turns that off. */
  prefixes: z
    .array(z.enum(FOLDER_FILTER_PREFIXES))
    .max(FOLDER_FILTER_PREFIXES.length)
    .refine((list) => new Set(list).size === list.length, { message: 'duplicatePrefix' })
    .default(['!', '+']),
  /** The filter of a game in no prefixed folder; empty for none. */
  outside: z
    .string()
    .trim()
    .max(80)
    .refine((name) => name === '' || filterSlug(name) !== null, { message: 'notAFilterName' })
    .default('Official'),
  renames: z
    .array(FolderFilterRenameSchema)
    .max(FOLDER_FILTER_RENAMES_MAX)
    .superRefine((list, ctx) => {
      const seen = new Set<string>();
      list.forEach((entry, index) => {
        const key = folderKey(entry.folder);
        if (seen.has(key)) {
          ctx.addIssue({ code: 'custom', path: [index, 'folder'], message: 'duplicateRename' });
        }
        seen.add(key);
      });
    })
    .default([]),
});

export type FolderFilters = z.output<typeof FolderFiltersSchema>;

/** The settings, prepared once for many paths. */
export interface FolderFilterRules {
  prefixes: ReadonlySet<string>;
  outside: string | null;
  /** Folder key → filter slug. */
  renames: ReadonlyMap<string, string>;
}

export function folderFilterRules(settings: FolderFilters): FolderFilterRules {
  const renames = new Map<string, string>();
  for (const { folder, filter } of settings.renames) {
    const slug = filterSlug(filter);
    if (slug) renames.set(folderKey(folder), slug);
  }
  return {
    prefixes: new Set(settings.prefixes),
    outside: filterSlug(settings.outside),
    renames,
  };
}

/**
 * The filters a game's folders name (FR-LIB-18): one per folder of `relPath` (relative to the
 * system folder, `/`-separated) whose name starts with a prefix, without the prefixes and the
 * spaces after them, renamed when a rename matches; else the outside filter.
 */
export function folderFiltersOf(relPath: string, rules: FolderFilterRules): string[] {
  const filters: string[] = [];
  const folders = relPath.split('/').slice(0, -1);
  for (const folder of folders) {
    const name = folder.trim();
    if (!rules.prefixes.has(name.charAt(0))) continue;
    const key = folderKey(name);
    const slug = rules.renames.get(key) ?? filterSlug(key);
    if (slug && !filters.includes(slug)) filters.push(slug);
    if (filters.length === FOLDER_FILTERS_MAX) break;
  }
  if (filters.length === 0 && rules.outside) filters.push(rules.outside);
  return filters;
}

/** Same rules → same text: the library stores it to know when folder filters are stale. */
export function folderFiltersFingerprint(settings: FolderFilters): string {
  const rules = folderFilterRules(settings);
  return JSON.stringify({
    prefixes: [...rules.prefixes].sort(),
    outside: rules.outside,
    renames: [...rules.renames].sort(([a], [b]) => a.localeCompare(b)),
  });
}
