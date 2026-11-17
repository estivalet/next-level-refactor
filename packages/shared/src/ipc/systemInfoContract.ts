import { z } from 'zod';
import {
  SystemInfoSchema,
  SystemInfoSummarySchema,
  ThemeSystemInfoSchema,
} from '../systems/info.ts';
import { SystemGalleryImageSchema, SystemPersonalSchema } from '../systems/personal.ts';

const systemId = z.string().min(1).max(100);

/** The Systems museum (FR-MUS-1..5). */
export const systemInfoContract = {
  'systems.info.list': { input: z.void(), output: z.array(SystemInfoSummarySchema) },
  'systems.info.get': {
    input: z.strictObject({ systemId }),
    output: z.object({ entry: SystemInfoSchema, edited: z.boolean() }),
  },
  'systems.info.save': {
    input: z.strictObject({ systemId, entry: SystemInfoSchema }),
    output: SystemInfoSchema,
  },
  'systems.info.reset': { input: z.strictObject({ systemId }), output: SystemInfoSchema },
  /** FR-MUS-4: the merged entry with owned top games resolved; null for an unknown system. */
  'systems.info.forTheme': {
    input: z.strictObject({ systemId }),
    output: ThemeSystemInfoSchema.nullable(),
  },
  /** FR-MUS-6, FR-MUS-8: the owner's notes and gallery, stored apart from the entry. */
  'systems.personal.get': { input: z.strictObject({ systemId }), output: SystemPersonalSchema },
  'systems.personal.save': {
    input: z.strictObject({ systemId, personal: SystemPersonalSchema }),
    output: SystemPersonalSchema,
  },
  /** Opens a picker in main and copies the chosen images in. */
  'systems.personal.addImages': {
    input: z.strictObject({ systemId }),
    output: z.object({
      added: z.array(SystemGalleryImageSchema),
      rejected: z.array(
        z.object({ name: z.string(), reason: z.enum(['type', 'size', 'unreadable']) }),
      ),
    }),
  },
  /** Deletes stored images the saved record no longer lists. */
  'systems.personal.cleanup': { input: z.strictObject({ systemId }), output: z.void() },
} as const;
