import { z } from 'zod';
import { EXTENSION, SYSTEM_KINDS } from '../catalog/schema.ts';

// Systems the user adds in Settings → Systems (FR-EMU-11), for hardware the shipped catalog
// doesn't have yet. Their ids start with `custom-`, so they never clash with a catalog id
// (ADR-011); the id is fixed when the system is created and survives renames.

export const CUSTOM_SYSTEM_ID = /^custom-[a-z0-9]+(-[a-z0-9]+)*$/;

const optionalText = (max: number) => z.string().trim().min(1).max(max).optional();

export const CustomSystemSchema = z.object({
  id: z.string().regex(CUSTOM_SYSTEM_ID),
  name: z.string().trim().min(1).max(120),
  shortName: optionalText(40),
  manufacturer: optionalText(80),
  releaseYear: z.number().int().min(1950).max(2100).optional(),
  kind: z.enum(SYSTEM_KINDS).default('console'),
  description: optionalText(2000),
  /** The ROM folder inside each storage location (FR-LIB-1). */
  folderName: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[^<>:"/\\|?*]+$/),
  extensions: z.array(z.string().regex(EXTENSION)).min(1),
  screenscraperId: z.number().int().positive().optional(),
  launchboxPlatform: optionalText(120),
});

export type CustomSystem = z.output<typeof CustomSystemSchema>;

/** Reports a repeated id or name (names ignore case and outer spaces) on the later entry. */
export function checkCustomSystems(systems: readonly CustomSystem[], ctx: z.RefinementCtx): void {
  const ids = new Set<string>();
  const names = new Set<string>();
  systems.forEach((system, index) => {
    if (ids.has(system.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['customSystems', index, 'id'],
        message: 'duplicateSystemId',
      });
    }
    ids.add(system.id);
    const name = system.name.trim().toLowerCase();
    if (names.has(name)) {
      ctx.addIssue({
        code: 'custom',
        path: ['customSystems', index, 'name'],
        message: 'duplicateSystemName',
      });
    }
    names.add(name);
  });
}

/** `custom-<slug of name>` (`+` reads "plus"), numbered when `taken` already has it. */
export function customSystemId(name: string, taken: Iterable<string>): string {
  const slug =
    name
      .toLowerCase()
      .replaceAll('+', ' plus ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'system';
  const used = new Set(taken);
  const base = `custom-${slug}`;
  let id = base;
  for (let n = 2; used.has(id); n += 1) id = `${base}-${String(n)}`;
  return id;
}
