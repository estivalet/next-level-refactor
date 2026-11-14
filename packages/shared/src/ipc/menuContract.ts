import { z } from 'zod';
import {
  MenuDocumentSchema,
  MenuDraftSchema,
  MenuSummarySchema,
  MenuTitleSchema,
} from '../menus/schema.ts';

const menuId = z.uuid();

/** The Menu Editor's menus (FR-MENU-1..3). */
export const menuContract = {
  'menus.list': { input: z.void(), output: z.array(MenuSummarySchema) },
  'menus.get': { input: z.strictObject({ id: menuId }), output: MenuDocumentSchema },
  /** FR-MENU-3: the active menu, or the generated one (revision 0, not stored) when none exists. */
  'menus.draft': { input: z.void(), output: MenuDocumentSchema },
  /** A generated menu of the enabled systems with games, as of now. */
  'menus.generated': { input: z.void(), output: MenuDraftSchema },
  'menus.save': {
    input: MenuDraftSchema.extend({ id: menuId, baseRevision: z.number().int().min(0) }).strict(),
    output: MenuDocumentSchema,
  },
  'menus.create': {
    input: z.strictObject({ title: MenuTitleSchema, nodes: MenuDraftSchema.shape.nodes }),
    output: MenuDocumentSchema,
  },
  'menus.delete': { input: z.strictObject({ id: menuId }), output: z.void() },
  'menus.setActive': { input: z.strictObject({ id: menuId }), output: z.void() },
} as const;
