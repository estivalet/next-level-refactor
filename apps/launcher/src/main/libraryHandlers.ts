import { AppErrorException, ERROR_CODES } from '@nextlevel/shared';
import { dirname } from 'node:path';
import type { MainDeps } from './handlers.ts';
import type { IpcHandlers } from './ipc/router.ts';
import type { LaunchChannel } from './launchHandlers.ts';

type LibraryChannel = Exclude<
  Extract<keyof IpcHandlers, `library.${string}` | `collections.${string}`>,
  LaunchChannel
>;

/** The closest folder of `path` that exists; null when not even the drive does. */
export function nearestExisting(path: string, exists: (path: string) => boolean): string | null {
  let current = dirname(path);
  for (;;) {
    if (exists(current)) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/**
 * Game Library and collection channels (FR-LIB-6..8, FR-LIB-10). Game changes are announced with
 * `library.changed` so every open view, and later the themes, refresh.
 */
export function createLibraryHandlers(deps: MainDeps): Pick<IpcHandlers, LibraryChannel> {
  const library = () => {
    if (!deps.library) {
      throw new AppErrorException({
        code: 'LIBRARY_UNAVAILABLE',
        message: ERROR_CODES.LIBRARY_UNAVAILABLE,
      });
    }
    return deps.library;
  };
  const changed = (gameIds: number[]) => {
    deps.emit('library.changed', { systems: library().games.systemOf(gameIds), gameIds });
  };
  // A menu shows a collection by name and hides it while it has no games (FR-MENU-2).
  const announceMenus = () => {
    deps.emit('menus.changed', {});
  };
  const menuChanged = <T>(value: T): T => {
    announceMenus();
    return value;
  };

  return {
    'library.games.list': (query) => library().games.list(query),
    'library.games.get': ({ gameId }) => library().games.get(gameId),
    'library.games.updateMetadata': ({ gameId, changes }) => {
      const details = library().games.updateMetadata(gameId, changes, deps.clock());
      changed([gameId]);
      return details;
    },
    'library.games.setFlags': ({ gameIds, flags }) => {
      library().games.setFlags(gameIds, flags);
      changed(gameIds);
    },
    'library.games.relink': ({ missingGameId, replacementGameId }) => {
      const details = library().games.relink(missingGameId, replacementGameId);
      changed([missingGameId]);
      return details;
    },
    'library.games.reveal': ({ gameId }) => {
      const { path, missing } = library().games.filePath(gameId);
      // A missing file can't be selected; show the closest folder that still exists.
      const target = missing ? nearestExisting(path, deps.pathExists) : path;
      if (target) deps.revealFile(target);
      else deps.log.warn({ gameId, path }, 'nothing to reveal for a missing game');
    },
    'library.search': ({ text, limit }) => library().games.search(text, limit),
    'collections.list': () => library().collections.list(),
    'collections.create': ({ name }) => library().collections.create(name),
    'collections.update': ({ id, name, sort }) =>
      menuChanged(
        library().collections.update(id, {
          ...(name === undefined ? {} : { name }),
          ...(sort === undefined ? {} : { sort }),
        }),
      ),
    'collections.delete': ({ id }) => {
      library().collections.delete(id);
      announceMenus();
    },
    'collections.addGames': ({ id, gameIds }) =>
      menuChanged(library().collections.addGames(id, gameIds)),
    'collections.removeGames': ({ id, gameIds }) =>
      menuChanged(library().collections.removeGames(id, gameIds)),
    'collections.reorder': ({ id, gameId, swapWithGameId }) => {
      library().collections.reorder(id, gameId, swapWithGameId);
    },
  };
}
