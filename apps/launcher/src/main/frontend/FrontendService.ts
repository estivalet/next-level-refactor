import {
  AppErrorException,
  ERROR_CODES,
  type MenuTree,
  type Settings,
  type SystemDefinition,
  type ThemeGame,
} from '@nextlevel/shared';
import type { CollectionRepository } from '../library/CollectionRepository.ts';
import type { LibraryDb } from '../library/openLibrary.ts';
import { buildMenuTree } from './menuTree.ts';

export interface FrontendDeps {
  db: LibraryDb;
  catalog: () => readonly SystemDefinition[];
  settings: () => Settings;
  collections: Pick<CollectionRepository, 'list'>;
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
  (select group_concat(k.kind, char(31)) from (select kind from game_media
     where game_id = g.id order by kind) k) as media`;

const FROM = `from games g join game_metadata m on m.game_id = g.id
  left join game_user_state u on u.game_id = g.id`;

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

function toThemeGame(raw: RawThemeGame): ThemeGame {
  return {
    ...raw,
    favorite: raw.favorite === 1,
    hidden: raw.hidden === 1,
    filters: split(raw.filters),
    media: split(raw.media),
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

  menu(): MenuTree {
    const own = this.deps.settings().systems;
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
    return buildMenuTree({
      systems: this.deps.catalog().filter((system) => own[system.id]?.enabled === true),
      gameCounts: new Map(counts.map((row) => [row.id, row.n])),
      filtersBySystem,
      collections: this.deps.collections.list(),
    });
  }

  /** Every present game of a system, a system filter or a collection, in display order. */
  games(nodeId: string): ThemeGame[] {
    const system = /^s:([a-z0-9-]+)$/.exec(nodeId);
    const filter = /^s:([a-z0-9-]+):f:([a-z0-9-]+)$/.exec(nodeId);
    const collection = /^c:([1-9]\d*)$/.exec(nodeId);
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
    } else {
      throw notFound(nodeId);
    }
    return rows.map(toThemeGame);
  }
}
