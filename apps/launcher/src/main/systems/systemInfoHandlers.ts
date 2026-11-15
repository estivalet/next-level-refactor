import {
  AppErrorException,
  ERROR_CODES,
  type SystemDefinition,
  type SystemInfo,
  type CustomSystem,
} from '@nextlevel/shared';
import type { EmitEvent } from '../ipc/events.ts';
import type { IpcHandlers } from '../ipc/router.ts';
import { notFound } from '../library/libraryErrors.ts';
import type { SystemInfoRepository } from '../library/SystemInfoRepository.ts';
import { baseSystemInfo } from './mergeSystemInfo.ts';

type SystemInfoChannel = Extract<keyof IpcHandlers, `systems.info.${string}`>;

const appError = (code: 'VALIDATION_FAILED' | 'LIBRARY_UNAVAILABLE') =>
  new AppErrorException({ code, message: ERROR_CODES[code] });

/**
 * Museum channels (FR-MUS-1..4). The entry shown is the owner's edit when there is one, else the
 * shipped seed (or a custom system's settings fields). Without a library the base entries are
 * served read-only.
 */
export function createSystemInfoHandlers(deps: {
  systems: () => readonly SystemDefinition[];
  customSystems: () => readonly CustomSystem[];
  /** null when the library is unavailable. */
  repo: () => SystemInfoRepository | null;
  emit: EmitEvent;
  log: { warn(context: object, msg: string): void };
}): Pick<IpcHandlers, SystemInfoChannel> {
  const system = (systemId: string): SystemDefinition => {
    const found = deps.systems().find((candidate) => candidate.id === systemId);
    if (!found) throw notFound({ systemId });
    return found;
  };
  const base = (definition: SystemDefinition): SystemInfo =>
    baseSystemInfo(
      definition,
      deps.customSystems().find((custom) => custom.id === definition.id),
    );
  const writable = (): SystemInfoRepository => {
    const repo = deps.repo();
    if (!repo) throw appError('LIBRARY_UNAVAILABLE');
    return repo;
  };
  /**
   * `edited` follows the row's existence, so Reset stays available for a row that no longer
   * validates; such a row serves the base entry and logs a warning (never the entry's content).
   */
  const merged = (definition: SystemDefinition, editedIds?: ReadonlySet<string>) => {
    const repo = deps.repo();
    const edited = (editedIds ?? repo?.editedIds())?.has(definition.id) ?? false;
    const edit = edited ? (repo?.get(definition.id) ?? null) : null;
    if (edited && edit === null) {
      deps.log.warn({ systemId: definition.id }, 'unreadable museum edit; showing the original');
    }
    return { entry: edit ?? base(definition), edited };
  };

  return {
    'systems.info.list': () => {
      const edited = deps.repo()?.editedIds() ?? new Set<string>();
      return [...deps.systems()]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        .map((definition) => {
          const { entry } = merged(definition, edited);
          return {
            systemId: definition.id,
            name: definition.name,
            kind: definition.kind,
            manufacturer: entry.manufacturer ?? null,
            releaseYear: entry.releaseYear ?? null,
            edited: edited.has(definition.id),
          };
        });
    },
    'systems.info.get': ({ systemId }) => merged(system(systemId)),
    'systems.info.save': ({ systemId, entry }) => {
      system(systemId);
      if (entry.systemId !== systemId) throw appError('VALIDATION_FAILED');
      const saved = writable().save(entry);
      deps.emit('systems.infoChanged', { systemId });
      return saved;
    },
    'systems.info.reset': ({ systemId }) => {
      const definition = system(systemId);
      writable().reset(systemId);
      deps.emit('systems.infoChanged', { systemId });
      return base(definition);
    },
    'systems.info.forTheme': ({ systemId }) => {
      const definition = deps.systems().find((candidate) => candidate.id === systemId);
      if (!definition) return null;
      const { entry } = merged(definition);
      const repo = deps.repo();
      const topGames = repo
        ? repo.resolveTopGames(systemId, entry.topGames)
        : entry.topGames.map((game) => ({ ...game, owned: null }));
      return { ...entry, topGames };
    },
  };
}
