import { z } from 'zod';
import { ImportReportSchema, ImportSummarySchema } from '../import/report.ts';

/** Import NextLevelOS (FR-IMP-1, FR-IMP-2, D14, D63). */
export const importContract = {
  /** D14: the emulators folder to suggest for a NextLevelOS data folder (null: none found). */
  'import.inspect': {
    input: z.strictObject({ folder: z.string().trim().min(3).max(500) }),
    output: z.object({ emulatorsFolder: z.string().nullable() }),
  },
  /** FR-IMP-2: what importing the folder would do; writes nothing. */
  'import.dryRun': {
    input: z.strictObject({
      folder: z.string().trim().min(3).max(500),
      emulatorsFolder: z.string().trim().min(3).max(500).nullable(),
      /** D63: import only the Essentials collections. */
      essentialsOnly: z.boolean().optional(),
    }),
    output: ImportReportSchema,
  },
  /** FR-IMP-1, US-B3: imports the folder; `reportToken` is the dry run's (CONFLICT if changed). */
  'import.apply': {
    input: z.strictObject({
      folder: z.string().trim().min(3).max(500),
      emulatorsFolder: z.string().trim().min(3).max(500).nullable(),
      reportToken: z.string().min(1).max(200),
      essentialsOnly: z.boolean().optional(),
    }),
    output: ImportSummarySchema,
  },
} as const;
