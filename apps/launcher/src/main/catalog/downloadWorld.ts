import {
  AppErrorException,
  ERROR_CODES,
  type CatalogItem,
  type DownloadGrant,
  type IpcEvent,
  type IpcEventPayload,
} from '@nextlevel/shared';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { DownloadRepository } from '../library/DownloadRepository.ts';
import { tempDir, tempLibrary } from '../library/testing.ts';
import { DownloadService } from './DownloadService.ts';
import { fakeFilesServer } from './fakeFilesServer.ts';
import { ItemLocks } from './itemLocks.ts';
import { catalogItem } from './testing.ts';
import type { VerifiedFile } from './types.ts';

/**
 * DownloadService under test: a real files server with Range, a temp library and folder, and
 * a recording installer. `add` publishes an item whose files are dummy bytes.
 */
export async function downloadWorld(closers: Array<() => Promise<void>>) {
  const server = await fakeFilesServer();
  const library = await tempLibrary();
  const temp = await tempDir('nextlevel-downloads-');
  closers.push(server.close, library.cleanup, temp.cleanup);
  const repo = new DownloadRepository(library.db);
  const items = new Map<string, CatalogItem>();
  const timeline: string[] = [];
  const events: Array<{ event: IpcEvent; payload: unknown }> = [];
  const installed: Array<{ item: CatalogItem; files: VerifiedFile[]; bytes: Buffer[] }> = [];
  /** Every log call's arguments. */
  const logged: unknown[][] = [];
  const log = {
    info: (...args: unknown[]) => logged.push(args),
    warn: (...args: unknown[]) => logged.push(args),
    error: (...args: unknown[]) => logged.push(args),
  };
  const state: {
    free: number;
    offline: boolean;
    grantCalls: number;
    /** Answers the next grant instead of the default. */
    nextGrant: ((itemId: string) => Promise<DownloadGrant>) | null;
    /** While set, checksums wait for it (a download held in verify). */
    verifyGate: Promise<void> | null;
    verifying: number;
  } = {
    free: 10 ** 12,
    offline: false,
    grantCalls: 0,
    nextGrant: null,
    verifyGate: null,
    verifying: 0,
  };
  const grants = (itemId: string): Promise<DownloadGrant> => {
    timeline.push(`grant ${itemId}`);
    state.grantCalls += 1;
    const override = state.nextGrant;
    state.nextGrant = null;
    if (override) return override(itemId);
    if (state.offline) {
      return Promise.reject(
        new AppErrorException({ code: 'API_UNREACHABLE', message: ERROR_CODES.API_UNREACHABLE }),
      );
    }
    const item = items.get(itemId);
    if (!item) {
      return Promise.reject(
        new AppErrorException({ code: 'NOT_FOUND', message: ERROR_CODES.NOT_FOUND }),
      );
    }
    return Promise.resolve({
      files: item.files.map((file) => ({
        fileId: file.id,
        filename: file.filename,
        size: file.size,
        sha256: file.sha256,
        url: server.url(`${itemId}-${file.id}`),
        expiresAt: '2026-10-29T10:10:00.000Z',
      })),
    });
  };
  let ids = 0;
  const make = () =>
    new DownloadService({
      repo,
      catalog: {
        get: (itemId) => {
          const item = items.get(itemId);
          return item
            ? Promise.resolve(item)
            : Promise.reject(
                new AppErrorException({ code: 'NOT_FOUND', message: ERROR_CODES.NOT_FOUND }),
              );
        },
        downloads: grants,
      },
      installer: {
        install: async (item, files) => {
          timeline.push(`install ${item.id}`);
          installed.push({
            item,
            files: [...files],
            bytes: await Promise.all(files.map((file) => readFile(file.path))),
          });
          return { gameId: installed.length };
        },
      },
      dir: temp.dir,
      fetch,
      freeSpace: () => Promise.resolve(state.free),
      emit: <E extends IpcEvent>(event: E, payload: IpcEventPayload<E>) => {
        events.push({ event, payload });
      },
      log,
      clock: () => new Date('2026-10-29T10:00:00.000Z'),
      newId: () => {
        ids += 1;
        return `d${String(ids)}`;
      },
      locks: new ItemLocks(),
      hash: async (path, signal) => {
        state.verifying += 1;
        if (state.verifyGate) {
          const gate = state.verifyGate;
          await new Promise<void>((resolve, reject) => {
            signal.addEventListener('abort', () => {
              reject(signal.reason as Error);
            });
            void gate.then(resolve);
          });
        }
        return createHash('sha256')
          .update(await readFile(path))
          .digest('hex');
      },
    });

  /** Publishes an item; `bodies` are its files' bytes (a wrong `sha256` makes C9 fail). */
  const add = (itemId: string, bodies: Buffer[], opts: { badSha?: boolean } = {}) => {
    const files = bodies.map((body, index) => {
      const id = `f${String(index + 1)}`;
      server.serve(`${itemId}-${id}`, body);
      return {
        id,
        filename: `Game ${itemId} ${String(index + 1)}.nes`,
        size: body.length,
        sha256: opts.badSha ? 'b'.repeat(64) : createHash('sha256').update(body).digest('hex'),
        role: 'rom' as const,
      };
    });
    const item = catalogItem({
      id: itemId,
      title: `Game ${itemId}`,
      files,
      size: bodies.reduce((sum, body) => sum + body.length, 0),
    });
    items.set(itemId, item);
    return item;
  };

  const eventsOf = <E extends IpcEvent>(event: E) =>
    events.filter((e) => e.event === event).map((e) => e.payload as IpcEventPayload<E>);

  return {
    server,
    repo,
    db: library.db,
    dir: temp.dir,
    make,
    add,
    installed,
    timeline,
    eventsOf,
    /** Replaces what the API answers for the item (its files, its art URLs…). */
    setItem: (item: CatalogItem) => {
      items.set(item.id, item);
    },
    logged,
    state,
    token: (itemId: string, fileId = 'f1') => `${itemId}-${fileId}`,
  };
}

export const body = (label: string, repeat = 40) =>
  Buffer.from(`NEXTLEVEL TEST FIXTURE ${label}\n`.repeat(repeat));
