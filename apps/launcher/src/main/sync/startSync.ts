import { AppErrorException, type SyncKind } from '@nextlevel/shared';
import { createHash, randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { v7 as uuidv7 } from 'uuid';
import type { ApiClient } from '../auth/ApiClient.ts';
import type { AuthService } from '../auth/AuthService.ts';
import type { EmitEvent } from '../ipc/events.ts';
import type { GameRepository } from '../library/GameRepository.ts';
import type { LibraryDb } from '../library/openLibrary.ts';
import { MenuRepository } from '../menus/MenuRepository.ts';
import type { SettingsService } from '../settings/SettingsService.ts';
import { currentSettings } from '../startLibrary.ts';
import { collectionsDoc } from './collectionsDoc.ts';
import type { KindAdapter } from './documents.ts';
import { menusDoc } from './menusDoc.ts';
import { settingsDoc } from './settingsDoc.ts';
import { SyncService } from './SyncService.ts';
import { userStateDoc } from './userStateDoc.ts';

/** D64: this PC as 16 hex characters (the host name itself never leaves the PC). */
export function hostId(name: string): string {
  return createHash('sha256').update(name.trim().toLowerCase()).digest('hex').slice(0, 16);
}

export interface StartSyncDeps {
  settings: SettingsService;
  /** The open library; without it only settings sync. */
  library: { db: LibraryDb; games: GameRepository } | null;
  auth: AuthService;
  api: ApiClient;
  dataDir: string;
  emit: EmitEvent;
  log: { warn(context: object, msg: string): void };
}

/** Settings sync (FR-SET-5, D55) over the library and settings; started after sign-in is set up. */
export function startSync(deps: StartSyncDeps): SyncService {
  const clock = () => new Date();
  const update = async (change: Parameters<SettingsService['update']>[0]) => {
    const result = await deps.settings.update(change);
    if (!result.ok) throw new AppErrorException(result.error);
  };
  const library = deps.library;
  const menus = library ? new MenuRepository(library.db, clock, uuidv7) : null;
  const collectionsChanged = () => {
    deps.emit('library.changed', { systems: [] });
    deps.emit('menus.changed', {});
  };
  const kinds = (): Partial<Record<SyncKind, KindAdapter>> => {
    const settings = settingsDoc({
      settings: () => currentSettings(deps.settings),
      update,
      log: deps.log,
    });
    if (!library || !menus) return { settings };
    return {
      settings,
      collections: collectionsDoc({
        db: library.db,
        newId: randomUUID,
        clock,
        changed: collectionsChanged,
        log: deps.log,
      }),
      userState: userStateDoc({
        db: library.db,
        deviceKey: () => currentSettings(deps.settings).sync.deviceKey ?? '',
        changed: (gameIds) => {
          deps.emit('library.changed', { systems: library.games.systemOf(gameIds), gameIds });
        },
      }),
      menus: menusDoc({
        db: library.db,
        menus,
        newId: uuidv7,
        changed: () => {
          deps.emit('menus.changed', {});
        },
        log: deps.log,
      }),
    };
  };
  const service = new SyncService({
    api: deps.api,
    auth: deps.auth,
    section: () => currentSettings(deps.settings).sync,
    writeSection: (section) => update((settings) => ({ ...settings, sync: section })),
    kinds,
    file: join(deps.dataDir, 'sync.json'),
    newId: randomUUID,
    hostId: () => hostId(hostname()),
    clock,
    every: (ms, run) => {
      const timer = setInterval(run, ms);
      return () => {
        clearInterval(timer);
      };
    },
    after: (ms, run) => {
      const timer = setTimeout(run, ms);
      return () => {
        clearTimeout(timer);
      };
    },
    emit: (state) => {
      deps.emit('sync.changed', state);
    },
    log: deps.log,
  });
  void service.start();
  return service;
}
