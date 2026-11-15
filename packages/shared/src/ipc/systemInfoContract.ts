import { z } from 'zod';
import {
  SystemInfoSchema,
  SystemInfoSummarySchema,
  ThemeSystemInfoSchema,
} from '../systems/info.ts';

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
} as const;
