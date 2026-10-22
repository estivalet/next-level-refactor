import { z } from 'zod';

// Menus as user data (FR-MENU-1..4): a tree document the Menu Editor edits and main stores in
// `menus` + `menu_nodes`. Themes never see it; main resolves it into a `MenuTree`.

/** FR-MENU-2's node types. A system's filter entries are generated, never stored. */
export const MENU_DOC_NODE_TYPES = ['category', 'system', 'collection', 'smartFilter'] as const;

export const MAX_MENU_NODES = 5000;

export const MenuTitleSchema = z.string().trim().min(1).max(100);

export type MenuDocNodeType = (typeof MENU_DOC_NODE_TYPES)[number];

export type MenuDocNode = {
  id: string;
  type: MenuDocNodeType;
  /** System id, or a collection / smart filter id as a string; null for categories. */
  refId: string | null;
  /** The menu-art key; references start with their target's name. */
  name: string;
  displayName: string | null;
  shortName: string | null;
  /** System nodes: show the system's filter entries/tabs (FR-MENU-4). */
  filterTabs: boolean;
  visible: boolean;
  children: MenuDocNode[];
};

/** A node as sent: `filterTabs` and `visible` may be left out. */
export type MenuDocNodeInput = Omit<MenuDocNode, 'filterTabs' | 'visible' | 'children'> & {
  filterTabs?: boolean | undefined;
  visible?: boolean | undefined;
  children: MenuDocNodeInput[];
};

const optionalLabel = z.string().trim().max(200).nullable();

export const MenuDocNodeSchema: z.ZodType<MenuDocNode, MenuDocNodeInput> = z.lazy(() =>
  z
    .object({
      id: z.uuid(),
      type: z.enum(MENU_DOC_NODE_TYPES),
      refId: z.string().min(1).max(100).nullable(),
      name: z.string().trim().min(1).max(200),
      displayName: optionalLabel,
      shortName: optionalLabel,
      filterTabs: z.boolean().default(true),
      visible: z.boolean().default(true),
      children: z.array(MenuDocNodeSchema),
    })
    .superRefine((node, ctx) => {
      if ((node.type === 'category') !== (node.refId === null)) {
        ctx.addIssue({ code: 'custom', path: ['refId'], message: 'refIdMismatch' });
      }
      if (node.type !== 'category' && node.children.length > 0) {
        ctx.addIssue({ code: 'custom', path: ['children'], message: 'childrenNotAllowed' });
      }
      if (
        (node.type === 'collection' || node.type === 'smartFilter') &&
        node.refId !== null &&
        !/^[1-9]\d{0,15}$/.test(node.refId)
      ) {
        ctx.addIssue({ code: 'custom', path: ['refId'], message: 'invalidRefId' });
      }
    }),
);

/** Every node of a tree, depth first. */
export function* walkMenuNodes(nodes: readonly MenuDocNode[]): Generator<MenuDocNode> {
  for (const node of nodes) {
    yield node;
    yield* walkMenuNodes(node.children);
  }
}

const MenuNodesSchema = z.array(MenuDocNodeSchema).superRefine((nodes, ctx) => {
  const seen = new Set<string>();
  for (const node of walkMenuNodes(nodes)) {
    if (seen.has(node.id)) {
      ctx.addIssue({ code: 'custom', message: 'duplicateNodeId', params: { id: node.id } });
      return;
    }
    seen.add(node.id);
    if (seen.size > MAX_MENU_NODES) {
      ctx.addIssue({ code: 'custom', message: 'tooManyNodes' });
      return;
    }
  }
});

/** What the editor saves: a title and the tree. */
export const MenuDraftSchema = z.object({ title: MenuTitleSchema, nodes: MenuNodesSchema });

export const MenuDocumentSchema = MenuDraftSchema.extend({
  id: z.uuid(),
  revision: z.number().int().min(0),
  active: z.boolean(),
  /** Import provenance (`nextlevelos:<file>`); null for menus made here. */
  source: z.string().nullable(),
});

export const MenuSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  active: z.boolean(),
  revision: z.number().int().min(0),
  source: z.string().nullable(),
  nodeCount: z.number().int().min(0),
});

export type MenuDraft = z.output<typeof MenuDraftSchema>;
export type MenuDocument = z.output<typeof MenuDocumentSchema>;
export type MenuSummary = z.output<typeof MenuSummarySchema>;
