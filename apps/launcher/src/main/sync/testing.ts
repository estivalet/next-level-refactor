import {
  AppErrorException,
  defaultSettings,
  SyncPutRequestSchema,
  type AuthState,
  type Settings,
  type SyncDocument,
} from '@nextlevel/shared';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { tempLibrary } from '../library/testing.ts';
import { MenuRepository } from '../menus/MenuRepository.ts';
import { collectionsDoc } from './collectionsDoc.ts';
import { menusDoc } from './menusDoc.ts';
import { settingsDoc } from './settingsDoc.ts';
import { SyncService } from './SyncService.ts';
import { userStateDoc } from './userStateDoc.ts';

const quiet = {
  warn: (context: object, msg: string) => {
    if (process.env['SYNC_DEBUG'] || msg === 'settings sync failed') console.warn(msg, context);
  },
};

/** The sync API (api-spec Sync) in memory: revisions, 409 with the server copy, DELETE. */
export function fakeSyncServer() {
  const docs = new Map<string, SyncDocument>();
  const calls: string[] = [];
  let tick = Date.parse('2026-11-13T12:00:00.000Z');
  const server = {
    docs,
    calls,
    offline: false,
    /** Runs once before the next PUT is handled (another PC writing first). */
    beforePut: null as (() => Promise<void>) | null,
    /** Runs once right after the next PUT is stored. */
    afterPut: null as (() => void) | null,
    request(method: string, path: string, _schema: unknown, opts: { body?: unknown } = {}) {
      calls.push(`${method} ${path}`);
      if (server.offline) {
        return Promise.reject(
          new AppErrorException({ code: 'API_UNREACHABLE', message: 'errors.apiUnreachable' }),
        );
      }
      const kind = path.replace('/v1/sync/', '');
      const doc = docs.get(kind) ?? { revision: 0, data: null, updatedAt: null };
      if (method === 'GET') return Promise.resolve(structuredClone(doc));
      if (method === 'DELETE') {
        for (const [key, value] of docs) {
          docs.set(key, { revision: value.revision + 1, data: null, updatedAt: value.updatedAt });
        }
        return Promise.resolve(undefined);
      }
      return (async () => {
        const hook = server.beforePut;
        if (hook) {
          server.beforePut = null;
          await hook();
        }
        const body = SyncPutRequestSchema.parse(opts.body);
        const current = docs.get(kind) ?? doc;
        if (body.baseRevision !== current.revision) {
          throw new AppErrorException({
            code: 'CONFLICT',
            message: 'errors.conflict',
            details: structuredClone(current),
          });
        }
        tick += 1000;
        const updatedAt = new Date(tick).toISOString();
        docs.set(kind, {
          revision: current.revision + 1,
          data: structuredClone(body.data),
          updatedAt,
        });
        const after = server.afterPut;
        server.afterPut = null;
        after?.();
        return { revision: current.revision + 1, updatedAt };
      })();
    },
  };
  return server;
}

type Server = ReturnType<typeof fakeSyncServer>;

const signedIn = (userId: string): AuthState =>
  ({
    kind: 'signedIn',
    user: { id: userId, email: 'a@example.com', name: 'A', avatarUrl: null, role: 'subscriber' },
    entitlement: {},
    offline: false,
    banner: null,
    remembered: true,
  }) as unknown as AuthState;

/** One PC: its own library, settings and sync.json, against `server`. */
export async function syncPc(
  server: Server,
  opts: {
    now?: () => Date;
    write?: (file: string, data: string) => Promise<void>;
    maxBytes?: (kind: string) => number;
  } = {},
) {
  const library = await tempLibrary();
  let settings: Settings = defaultSettings();
  let auth: AuthState = signedIn('user-1');
  const timers: Array<() => void> = [];
  const debounced: Array<() => void> = [];
  const events = { library: 0, menus: 0 };
  const clock = opts.now ?? (() => new Date('2026-11-13T12:00:00.000Z'));
  const menus = new MenuRepository(library.db, clock, randomUUID);
  const service = new SyncService({
    api: {
      request: <T>(...args: Parameters<Server['request']>) => server.request(...args) as Promise<T>,
    },
    auth: {
      accessCall: (call) => call('token'),
      state: () => auth,
      onChecked: () => () => undefined,
    },
    section: () => settings.sync,
    writeSection: (section) => {
      settings = { ...settings, sync: section };
      return Promise.resolve();
    },
    kinds: () => ({
      settings: settingsDoc({
        settings: () => settings,
        update: (change) => {
          settings = change(settings);
          return Promise.resolve();
        },
        log: quiet,
      }),
      collections: collectionsDoc({
        db: library.db,
        newId: randomUUID,
        clock,
        changed: () => (events.menus += 1),
        log: quiet,
      }),
      userState: userStateDoc({
        db: library.db,
        deviceKey: () => settings.sync.deviceKey ?? '',
        changed: () => (events.library += 1),
      }),
      menus: menusDoc({
        db: library.db,
        menus,
        newId: randomUUID,
        changed: () => (events.menus += 1),
        log: quiet,
      }),
    }),
    file: join(library.dir, 'sync.json'),
    ...(opts.write ? { write: opts.write } : {}),
    ...(opts.maxBytes ? { maxBytes: opts.maxBytes } : {}),
    newId: randomUUID,
    clock,
    every: (_ms, run) => {
      timers.push(run);
      return () => undefined;
    },
    after: (_ms, run) => {
      debounced.push(run);
      return () => undefined;
    },
    emit: () => undefined,
    log: quiet,
  });
  const client = library.db.$client;
  return {
    ...library,
    service,
    menus,
    events,
    timers,
    debounced,
    settings: () => settings,
    setSettings: (next: Settings) => {
      settings = next;
    },
    signOut: () => {
      auth = { kind: 'signedOut', reason: null } as unknown as AuthState;
    },
    state: (gameId: number) =>
      client
        .prepare(
          `select favorite, hidden, completed, user_rating as userRating, play_count as playCount,
             play_seconds as playSeconds, last_played_at as lastPlayedAt
           from game_user_state where game_id = ?`,
        )
        .get(gameId) as
        | {
            favorite: number;
            hidden: number;
            completed: number;
            userRating: number | null;
            playCount: number;
            playSeconds: number;
            lastPlayedAt: string | null;
          }
        | undefined,
    collection: (name: string) => {
      const id = client.prepare('select id from collections where name = ?').pluck().get(name) as
        number | undefined;
      if (id === undefined) return null;
      const titles = client
        .prepare(
          `select m.title from collection_games cg join game_metadata m on m.game_id = cg.game_id
           where cg.collection_id = ? order by cg.position`,
        )
        .pluck()
        .all(id) as string[];
      return { id, titles };
    },
  };
}
