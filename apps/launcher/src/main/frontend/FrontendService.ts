import {
  AppErrorException,
  ERROR_CODES,
  type MenuDraft,
  walkMenuNodes,
  type MenuTree,
  type Settings,
  type SystemDefinition,
  type ThemeGame,
} from '@nextlevel/shared';
import { mainText } from '../i18n/mainText.ts';
import type { CollectionRepository } from '../library/CollectionRepository.ts';
import type { LibraryDb } from '../library/openLibrary.ts';
import type { SmartFilterRepository } from '../library/SmartFilterRepository.ts';
import { generatedNodes } from '../menus/generatedDocument.ts';
import type { MenuRepository } from '../menus/MenuRepository.ts';
import { resolveMenu, type ResolveContext } from '../menus/resolveMenu.ts';
import { menuFingerprint } from './menuFingerprint.ts';
import { buildMenuTree } from './menuTree.ts';

export interface FrontendDeps {
  db: LibraryDb;
  catalog: () => readonly SystemDefinition[];
  settings: () => Settings;
  collections: Pick<CollectionRepository, 'list'>;
  menus: Pick<MenuRepository, 'active'>;
  smartFilters: Pick<SmartFilterRepository, 'names' | 'hasGames' | 'gameIds'>;
}

interface RawThemeGame {
  id: number;
  systemId: string;
  title: string;
  year: number | null;
  genre: string | null;
  players: string | null;
  developer: string | null;
  publisher: string | null;
  favorite: number;
  hidden: number;
  playCount: number;
  lastPlayedAt: string | null;
  filters: string | null;
  media: string | null;
}

// Filters and media kinds come back as one string per game; char(31) never appears in either.
const COLUMNS = `g.id as id, g.system_id as systemId, m.title as title, m.year as year,
  m.genre as genre, m.players as players, m.developer as developer, m.publisher as publisher,
  coalesce(u.favorite, 0) as favorite, coalesce(u.hidden, 0) as hidden,
  coalesce(u.play_count, 0) as playCount, u.last_played_at as lastPlayedAt,
  (select group_concat(f.filter, char(31)) from (select filter from game_filters
     where game_id = g.id order by filter) f) as filters,
  (select group_concat(k.kind || ':' || k.version, char(31)) from (select kind, version
     from game_media where game_id = g.id order by kind) k) as media`;

const FROM = `from games g join game_metadata m on m.game_id = g.id
  left join game_user_state u on u.game_id = g.id`;

/** A smart filter's games in its order: ids arrive as a JSON array, `j.key` is the position. */
const SMART_SQL = `select ${COLUMNS} from json_each(@ids) j join games g on g.id = j.value
  join game_metadata m on m.game_id = g.id left join game_user_state u on u.game_id = g.id
  order by j.key`;

const SQL = {
  system: `select ${COLUMNS} ${FROM} where g.missing = 0 and g.system_id = @systemId
    order by m.sort_title, g.id`,
  filter: `select ${COLUMNS} ${FROM} where g.missing = 0 and g.system_id = @systemId
    and exists (select 1 from game_filters x where x.game_id = g.id and x.filter = @filter)
    order by m.sort_title, g.id`,
  collection: `select ${COLUMNS} ${FROM} join collection_games cg on cg.game_id = g.id
    join collections c on c.id = cg.collection_id
    where g.missing = 0 and cg.collection_id = @collectionId
    order by case c.sort when 'title' then m.sort_title end,
      case c.sort when 'year' then coalesce(m.year, 9999) end,
      case c.sort when 'year' then m.sort_title end, cg.position, g.id`,
};

const split = (value: string | null) => (value ? value.split('\u001f') : []);

/** Media comes as `kind:version` pairs; a kind never holds a colon (MEDIA_KIND). */
function toThemeGame(raw: RawThemeGame): ThemeGame {
  const media: string[] = [];
  const mediaVersions: Record<string, number> = {};
  for (const pair of split(raw.media)) {
    const colon = pair.lastIndexOf(':');
    const kind = pair.slice(0, colon);
    media.push(kind);
    mediaVersions[kind] = Number(pair.slice(colon + 1));
  }
  return {
    ...raw,
    favorite: raw.favorite === 1,
    hidden: raw.hidden === 1,
    filters: split(raw.filters),
    media,
    mediaVersions,
  };
}

const notFound = (nodeId: string) =>
  new AppErrorException({ code: 'NOT_FOUND', message: ERROR_CODES.NOT_FOUND, details: { nodeId } });

/** What a ThemeHost reads over IPC (FR-THM-6): the generated menu and whole game levels. */
export class FrontendService {
  constructor(private readonly deps: FrontendDeps) {}

  private get client() {
    return this.deps.db.$client;
  }

  /** The active menu resolved for themes, or the generated one while no menu is stored. */
  menu(): MenuTree {
    const active = this.deps.menus.active();
    return active ? resolveMenu(active, this.resolveContext(active)) : this.generatedTree();
  }

  /** What decides which entries the menu can show (see `menuFingerprint`). */
  menuFingerprint(): string {
    return menuFingerprint(this.deps);
  }

  /** An unsaved menu resolved like the active one (Menu Editor preview). */
  resolveDraft(draft: MenuDraft): MenuTree {
    return resolveMenu(draft, this.resolveContext(draft));
  }

  /** The generated menu as an editable draft (FR-MENU-3). */
  generatedDraft(newId: () => string = () => crypto.randomUUID()): MenuDraft {
    const language = this.deps.settings().general.language;
    return {
      title: mainText(language, 'menus.defaultTitle'),
      nodes: generatedNodes(this.generatedTree(), newId, (key) => mainText(language, key)),
    };
  }

  private libraryCounts() {
    const counts = this.client
      .prepare(
        'select system_id as id, count(*) as n from games where missing = 0 group by system_id',
      )
      .all() as Array<{ id: string; n: number }>;
    const filters = this.client
      .prepare(
        `select distinct g.system_id as id, f.filter as filter from game_filters f
         join games g on g.id = f.game_id where g.missing = 0`,
      )
      .all() as Array<{ id: string; filter: string }>;
    const filtersBySystem = new Map<string, string[]>();
    for (const row of filters) {
      filtersBySystem.set(row.id, [...(filtersBySystem.get(row.id) ?? []), row.filter]);
    }
    return { gameCounts: new Map(counts.map((row) => [row.id, row.n])), filtersBySystem };
  }

  private enabledSystems() {
    const own = this.deps.settings().systems;
    return this.deps.catalog().filter((system) => own[system.id]?.enabled === true);
  }

  private generatedTree(): MenuTree {
    return buildMenuTree({
      systems: this.enabledSystems(),
      ...this.libraryCounts(),
      collections: this.deps.collections.list(),
    });
  }

  /**
   * What `draft` is resolved against. Collections and smart filters are looked at only when the
   * menu names them, and smart filters only for emptiness (one EXISTS each): the menu is resolved
   * on every `menus.changed`, so its cost must not grow with the library's lists.
   */
  private resolveContext(draft: MenuDraft): ResolveContext {
    const collectionIds: number[] = [];
    const smartFilterIds: number[] = [];
    for (const node of walkMenuNodes(draft.nodes)) {
      if (node.type === 'collection') collectionIds.push(Number(node.refId));
      if (node.type === 'smartFilter') smartFilterIds.push(Number(node.refId));
    }
    const present = new Map(
      (
        this.client
          .prepare(
            `select cg.collection_id as id, count(*) as n from collection_games cg
             join games g on g.id = cg.game_id
             where g.missing = 0 and cg.collection_id in (select value from json_each(?))
             group by cg.collection_id`,
          )
          .all(JSON.stringify(collectionIds)) as Array<{ id: number; n: number }>
      ).map((row) => [row.id, row.n]),
    );
    const collectionNames = new Map(
      this.deps.collections.list().map((collection) => [collection.id, collection.name]),
    );
    const smartFilterNames = this.deps.smartFilters.names();
    const referenced = <T>(ids: number[], entry: (id: number) => T | null) =>
      new Map(
        [...new Set(ids)].flatMap((id) => {
          const value = entry(id);
          return value === null ? [] : [[id, value] as const];
        }),
      );
    return {
      systems: new Map(this.deps.catalog().map((system) => [system.id, system])),
      enabled: new Set(this.enabledSystems().map((system) => system.id)),
      ...this.libraryCounts(),
      collections: referenced(collectionIds, (id) => {
        const name = collectionNames.get(id);
        return name === undefined ? null : { name, games: present.get(id) ?? 0 };
      }),
      // `games` is 0 or 1 here: the resolver only asks whether a smart filter is empty.
      smartFilters: referenced(smartFilterIds, (id) => {
        const name = smartFilterNames.get(id);
        return name === undefined
          ? null
          : { name, games: this.deps.smartFilters.hasGames(id) ? 1 : 0 };
      }),
    };
  }

  /** Every present game of a system, a system filter or a collection, in display order. */
  games(nodeId: string): ThemeGame[] {
    // `s:snes~2` is the second menu entry for SNES (resolveMenu): same games.
    const id = nodeId.replace(/~[1-9]\d*(?=$|:)/, '');
    const system = /^s:([a-z0-9-]+)$/.exec(id);
    const filter = /^s:([a-z0-9-]+):f:([a-z0-9-]+)$/.exec(id);
    const collection = /^c:([1-9]\d*)$/.exec(id);
    const smart = /^sf:([1-9]\d*)$/.exec(id);
    let rows: RawThemeGame[];
    if (system?.[1] || filter?.[1]) {
      const systemId = system?.[1] ?? filter?.[1] ?? '';
      if (!this.deps.catalog().some((s) => s.id === systemId)) throw notFound(nodeId);
      rows = filter
        ? (this.client.prepare(SQL.filter).all({ systemId, filter: filter[2] }) as RawThemeGame[])
        : (this.client.prepare(SQL.system).all({ systemId }) as RawThemeGame[]);
    } else if (collection?.[1]) {
      const collectionId = Number(collection[1]);
      if (!this.client.prepare('select 1 from collections where id = ?').get(collectionId)) {
        throw notFound(nodeId);
      }
      rows = this.client.prepare(SQL.collection).all({ collectionId }) as RawThemeGame[];
    } else if (smart?.[1]) {
      let ids: number[];
      try {
        ids = this.deps.smartFilters.gameIds(Number(smart[1]));
      } catch {
        throw notFound(nodeId);
      }
      rows = this.client.prepare(SMART_SQL).all({ ids: JSON.stringify(ids) }) as RawThemeGame[];
    } else {
      throw notFound(nodeId);
    }
    return rows.map(toThemeGame);
  }
}
