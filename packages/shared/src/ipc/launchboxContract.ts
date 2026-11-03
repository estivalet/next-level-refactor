import { z } from 'zod';
import { LaunchBoxStatusSchema } from '../scraper/launchbox.ts';

/** LaunchBox database channels (FR-SCR-6). */
export const launchboxContract = {
  'launchbox.status': { input: z.void(), output: LaunchBoxStatusSchema },
  /** Downloads the database again and rebuilds the index; the old one stays until the swap. */
  'launchbox.refresh': { input: z.void(), output: LaunchBoxStatusSchema },
  'launchbox.cancel': { input: z.void(), output: LaunchBoxStatusSchema },
  /** Platform names of the index, for the platform picker. */
  'launchbox.platforms': { input: z.void(), output: z.array(z.string()) },
  'launchbox.setPlatform': {
    input: z.strictObject({
      systemId: z.string().min(1),
      platform: z.string().min(1).max(120),
    }),
    output: z.void(),
  },
} as const;

export const launchboxEvents = {
  'launchbox.status': LaunchBoxStatusSchema,
} as const;
