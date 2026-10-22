import {
  AppErrorException,
  ERROR_CODES,
  type MenuDocNode,
  type MenuDocument,
  type MenuDraft,
  type MenuSummary,
} from '@nextlevel/shared';
import { notFound } from '../library/GameRepository.ts';
import type { LibraryDb } from '../library/openLibrary.ts';

interface RawMenu {
  id: string;
  title: string;
  active: number;
  revision: number;
  source: string | null;
}

interface RawNode {
  id: string;
  parentId: string | null;
  type: MenuDocNode['type'];
  refId: string | null;
  name: string;
  displayName: string | null;
  shortName: string | null;
  filterTabs: number;
  visible: number;
}

const MENU_COLUMNS = 'id, title, active, revision, source';

/**
 * Menus as stored documents (FR-MENU-1..3): one row per menu, one per node with its parent and
 * position. A save replaces every node of the menu in one transaction and bumps `revision`; a
 * save from an older revision is refused (CONFLICT). At most one menu is active.
 */
export class MenuRepository {
  constructor(
    private readonly db: LibraryDb,
    private readonly clock: () => Date,
    private readonly newId: () => string,
  ) {}

  private get client() {
    return this.db.$client;
  }

  list(): MenuSummary[] {
    const rows = this.client
      .prepare(
        `select ${MENU_COLUMNS}, (select count(*) from menu_nodes n where n.menu_id = m.id) as nodeCount
         from menus m order by title collate nocase, id`,
      )
      .all() as Array<RawMenu & { nodeCount: number }>;
    return rows.map((row) => ({ ...this.header(row), nodeCount: row.nodeCount }));
  }

  get(id: string): MenuDocument {
    const row = this.client.prepare(`select ${MENU_COLUMNS} from menus where id = ?`).get(id) as
      RawMenu | undefined;
    if (!row) throw notFound({ menuId: id });
    return { ...this.header(row), nodes: this.nodes(id) };
  }

  active(): MenuDocument | null {
    const id = this.client.prepare('select id from menus where active = 1').pluck().get() as
      string | undefined;
    return id === undefined ? null : this.get(id);
  }

  /** A new menu; the first one becomes active. */
  create(title: string, nodes: readonly MenuDocNode[], source: string | null = null): MenuDocument {
    const id = this.newId();
    this.client.transaction(() => {
      const now = this.clock().toISOString();
      const anyActive = this.client.prepare('select 1 from menus where active = 1').get();
      this.client
        .prepare(
          `insert into menus (id, title, active, revision, source, created_at, updated_at)
           values (?, ?, ?, 0, ?, ?, ?)`,
        )
        .run(id, title, anyActive ? 0 : 1, source, now, now);
      this.writeNodes(id, nodes);
    })();
    return this.get(id);
  }

  save(id: string, draft: MenuDraft, baseRevision: number): MenuDocument {
    this.client.transaction(() => {
      const current = this.get(id);
      if (current.revision !== baseRevision) {
        throw new AppErrorException({
          code: 'CONFLICT',
          message: ERROR_CODES.CONFLICT,
          details: { menuId: id, revision: current.revision },
        });
      }
      this.replace(id, draft);
    })();
    return this.get(id);
  }

  /** D12: an imported menu is created once per source, then replaced in place. */
  upsertBySource(source: string, title: string, nodes: readonly MenuDocNode[]): MenuDocument {
    const id = this.client.prepare('select id from menus where source = ?').pluck().get(source) as
      string | undefined;
    if (id === undefined) return this.create(title, nodes, source);
    this.client.transaction(() => {
      this.replace(id, { title, nodes: [...nodes] });
    })();
    return this.get(id);
  }

  /** Deleting the active menu activates the most recently changed other one, if any. */
  delete(id: string): void {
    this.client.transaction(() => {
      const wasActive = this.get(id).active;
      this.client.prepare('delete from menus where id = ?').run(id);
      if (wasActive) {
        this.client
          .prepare(
            `update menus set active = 1 where id =
               (select id from menus order by updated_at desc, id desc limit 1)`,
          )
          .run();
      }
    })();
  }

  setActive(id: string): void {
    this.client.transaction(() => {
      this.get(id);
      this.client.prepare('update menus set active = 0 where active = 1').run();
      this.client.prepare('update menus set active = 1 where id = ?').run(id);
    })();
  }

  private header(row: RawMenu) {
    return {
      id: row.id,
      title: row.title,
      active: row.active === 1,
      revision: row.revision,
      source: row.source,
    };
  }

  private replace(id: string, draft: MenuDraft): void {
    this.client
      .prepare('update menus set title = ?, revision = revision + 1, updated_at = ? where id = ?')
      .run(draft.title, this.clock().toISOString(), id);
    this.client.prepare('delete from menu_nodes where menu_id = ?').run(id);
    this.writeNodes(id, draft.nodes);
  }

  private writeNodes(menuId: string, nodes: readonly MenuDocNode[]): void {
    const insert = this.client.prepare(
      `insert into menu_nodes (id, menu_id, parent_id, position, type, ref_id, name, display_name,
         short_name, filter_tabs, visible)
       values (@id, @menuId, @parentId, @position, @type, @refId, @name, @displayName,
         @shortName, @filterTabs, @visible)`,
    );
    const write = (children: readonly MenuDocNode[], parentId: string | null) => {
      children.forEach((node, position) => {
        insert.run({
          id: node.id,
          menuId,
          parentId,
          position,
          type: node.type,
          refId: node.refId,
          name: node.name,
          displayName: node.displayName,
          shortName: node.shortName,
          filterTabs: node.filterTabs ? 1 : 0,
          visible: node.visible ? 1 : 0,
        });
        write(node.children, node.id);
      });
    };
    write(nodes, null);
  }

  private nodes(menuId: string): MenuDocNode[] {
    const rows = this.client
      .prepare(
        `select id, parent_id as parentId, type, ref_id as refId, name, display_name as displayName,
           short_name as shortName, filter_tabs as filterTabs, visible
         from menu_nodes where menu_id = ? order by position`,
      )
      .all(menuId) as RawNode[];
    const byParent = new Map<string | null, RawNode[]>();
    for (const row of rows) {
      const siblings = byParent.get(row.parentId);
      if (siblings) siblings.push(row);
      else byParent.set(row.parentId, [row]);
    }
    const build = (parentId: string | null): MenuDocNode[] =>
      (byParent.get(parentId) ?? []).map((row) => ({
        id: row.id,
        type: row.type,
        refId: row.refId,
        name: row.name,
        displayName: row.displayName,
        shortName: row.shortName,
        filterTabs: row.filterTabs === 1,
        visible: row.visible === 1,
        children: build(row.id),
      }));
    return build(null);
  }
}
