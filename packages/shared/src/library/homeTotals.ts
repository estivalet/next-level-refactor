import { z } from 'zod';

const id = z.number().int().positive();

/**
 * What one Library home card reaches (FR-LIB-17): the systems, collections and smart filters under
 * a category, at any depth. Main counts the distinct games among them, so a game reached twice
 * (a system and its Essentials collection, two collections) counts once.
 */
export const HomeTotalsGroupSchema = z.strictObject({
  systemIds: z.array(z.string().min(1).max(200)).max(1000),
  collectionIds: z.array(id).max(1000),
  smartFilterIds: z.array(id).max(1000),
});

export const HomeTotalsRequestSchema = z.strictObject({
  groups: z.array(HomeTotalsGroupSchema).max(500),
});

/** One count per group, in request order. */
export const HomeTotalsSchema = z.array(z.number().int().min(0));

export type HomeTotalsGroup = z.infer<typeof HomeTotalsGroupSchema>;
export type HomeTotalsRequest = z.infer<typeof HomeTotalsRequestSchema>;
