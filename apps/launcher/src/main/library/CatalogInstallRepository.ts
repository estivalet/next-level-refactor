import type { OnLapse } from '@nextlevel/shared';
import type { LibraryDb } from './openLibrary.ts';

export interface InstallRow {
  gameId: number;
  itemId: string;
  version: number;
  /** Paths relative to the location, `/`-separated: exactly what the installer wrote. */
  files: string[];
  locationId: string;
  state: 'current' | 'update' | 'gone';
  onLapse: OnLapse;
  installedAt: string;
  systemId: string;
  relPath: string;
  title: string;
}

export interface InstallWrite {
  /** The game row to reuse (an update, or a local row at the same path); null = a new one. */
  gameId: number | null;
  systemId: string;
  relPath: string;
  locationId: string;
  size: number;
  mtime: number;
  title: string;
  itemId: string;
  version: number;
  files: string[];
  /** Only for a new install; an update keeps the stored rule until the next sync. */
  onLapse: OnLapse;
  now: string;
}

const SELECT = `select i.game_id as gameId, i.catalog_item_id as itemId, i.version, i.files,
  i.location_id as locationId, i.state, i.on_lapse as onLapse, i.installed_at as installedAt,
  g.system_id as systemId, g.rel_path as relPath, m.title
  from catalog_installs i join games g on g.id = i.game_id
  left join game_metadata m on m.game_id = i.game_id`;

type Raw = Omit<InstallRow, 'files' | 'title'> & { files: string; title: string | null };
const toRow = (raw: Raw): InstallRow => ({
  ...raw,
  files: JSON.parse(raw.files) as string[],
  title: raw.title ?? raw.relPath,
});

/** Installed catalog items (`catalog_installs`) and the game rows they own (FR-CAT-3, FR-CAT-5). */
export class CatalogInstallRepository {
  constructor(private readonly db: LibraryDb) {}

  byItem(itemId: string): InstallRow | undefined {
    const raw = this.db.$client.prepare(`${SELECT} where i.catalog_item_id = ?`).get(itemId) as
      Raw | undefined;
    return raw ? toRow(raw) : undefined;
  }

  all(): InstallRow[] {
    return (this.db.$client.prepare(`${SELECT} order by m.sort_title`).all() as Raw[]).map(toRow);
  }

  /** The game row at a system path, whatever its source. */
  gameAt(systemId: string, relPath: string): number | undefined {
    return this.db.$client
      .prepare('select id from games where system_id = ? and rel_path = ?')
      .pluck()
      .get(systemId, relPath) as number | undefined;
  }

  /** A favorite or a collection member: uninstalling it needs a confirmation (US-E3). */
  isKept(gameId: number): boolean {
    return (
      this.db.$client
        .prepare(
          `select 1 from game_user_state where game_id = @id and favorite = 1
           union all select 1 from collection_games where game_id = @id limit 1`,
        )
        .get({ id: gameId }) !== undefined
    );
  }

  /** The game row and its install record (call inside a transaction); answers the game id. */
  write(input: InstallWrite): number {
    const client = this.db.$client;
    let gameId = input.gameId;
    if (gameId === null) {
      gameId = Number(
        client
          .prepare(
            `insert into games (system_id, rel_path, source, catalog_item_id, location_id, size,
               mtime, added_at) values (?, ?, 'catalog', ?, ?, ?, ?, ?)`,
          )
          .run(
            input.systemId,
            input.relPath,
            input.itemId,
            input.locationId,
            input.size,
            input.mtime,
            input.now,
          ).lastInsertRowid,
      );
    } else {
      client
        .prepare(
          `update games set rel_path = ?, source = 'catalog', catalog_item_id = ?, location_id = ?,
             size = ?, mtime = ?, missing = 0, missing_since = null where id = ?`,
        )
        .run(input.relPath, input.itemId, input.locationId, input.size, input.mtime, gameId);
    }
    client
      .prepare(
        `insert or ignore into game_metadata (game_id, title, sort_title, updated_at)
         values (?, ?, ?, ?)`,
      )
      .run(gameId, input.title, input.title.toLowerCase(), input.now);
    client
      .prepare(
        `insert into catalog_installs (game_id, catalog_item_id, version, files, location_id,
           state, on_lapse, installed_at) values (?, ?, ?, ?, ?, 'current', ?, ?)
         on conflict (game_id) do update set catalog_item_id = excluded.catalog_item_id,
           version = excluded.version, files = excluded.files, location_id = excluded.location_id,
           state = 'current', installed_at = excluded.installed_at`,
      )
      .run(
        gameId,
        input.itemId,
        input.version,
        JSON.stringify(input.files),
        input.locationId,
        input.onLapse,
        input.now,
      );
    return gameId;
  }

  /** The catalog copy is gone but a local file remains at the same path: a local game again. */
  toLocal(gameId: number, locationId: string): void {
    this.db.$client.transaction(() => {
      this.db.$client
        .prepare(
          "update games set source = 'local', catalog_item_id = null, location_id = ? where id = ?",
        )
        .run(locationId, gameId);
      this.db.$client.prepare('delete from catalog_installs where game_id = ?').run(gameId);
    })();
  }

  /** The game and everything that hangs off it (metadata, media rows, install) by cascade. */
  removeGame(gameId: number): void {
    this.db.$client.prepare('delete from games where id = ?').run(gameId);
  }

  setState(itemId: string, state: InstallRow['state'], onLapse: OnLapse): void {
    this.db.$client
      .prepare('update catalog_installs set state = ?, on_lapse = ? where catalog_item_id = ?')
      .run(state, onLapse, itemId);
  }
}
