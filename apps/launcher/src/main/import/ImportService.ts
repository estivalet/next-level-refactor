import {
  AppErrorException,
  ERROR_CODES,
  type EmulatorPreset,
  type ErrorCode,
  type ImportReport,
  type ImportStage,
  type ImportSummary,
  type Settings,
  type SystemDefinition,
} from '@nextlevel/shared';
import { isDeepStrictEqual } from 'node:util';
import type { EmitEvent } from '../ipc/events.ts';
import type { ImportRepository } from '../library/ImportRepository.ts';
import type { MenuRepository } from '../menus/MenuRepository.ts';
import type { ScanService } from '../scan/ScanService.ts';
import type { Walker } from '../scan/walker.ts';
import type { SettingsService } from '../settings/SettingsService.ts';
import { addDetectedProfiles } from './detectedProfiles.ts';
import { dryRun, planImport, type ImportDeps, type ImportPlan } from './dryRun.ts';
import { bindCollections } from './mapMenus.ts';
import { mapSettings } from './mapSettings.ts';
import { addSystemConfigs } from './systemConfigs.ts';

export interface ImportServiceDeps {
  catalog: readonly SystemDefinition[];
  presets: readonly EmulatorPreset[];
  settings: Pick<SettingsService, 'get' | 'update'>;
  scan: Pick<ScanService, 'start' | 'whenIdle' | 'status'>;
  repo: ImportRepository;
  menus: Pick<MenuRepository, 'upsertBySource' | 'setActive'>;
  emit: EmitEvent;
  clock: () => Date;
  newId: () => string;
  detect: ImportDeps['detect'];
  createWalker: () => Walker;
  folderExists: (dir: string) => Promise<boolean>;
  fileExists: (path: string) => Promise<boolean>;
  listFiles: (dir: string) => Promise<string[]>;
  /** The newest settings backup id, to tell which backup the import made. */
  latestBackupId: () => Promise<string | null>;
}

function fail(code: ErrorCode, details?: unknown): never {
  throw new AppErrorException({ code, message: ERROR_CODES[code], details });
}

/**
 * Imports a NextLevelOS data folder (FR-IMP-1/2, US-B3, IA F6): a dry run that writes nothing,
 * then a staged apply — settings (one backup), games, collections, a scan of the imported systems,
 * menus — that is idempotent (D12) and keeps entries without files as missing games (D13). The
 * library follows the gamelists: the scan only finds files for listed games, and adds none.
 */
export class ImportService {
  private busy = false;

  constructor(private readonly deps: ImportServiceDeps) {}

  private currentSettings(): Settings {
    const loaded = this.deps.settings.get();
    if (loaded.kind !== 'ok') fail('INVALID_SETTINGS');
    return loaded.snapshot.settings;
  }

  private planDeps(): ImportDeps {
    const { deps } = this;
    return {
      catalog: deps.catalog,
      presets: deps.presets,
      settings: () => this.currentSettings(),
      newId: deps.newId,
      detect: deps.detect,
      createWalker: deps.createWalker,
      folderExists: deps.folderExists,
      fileExists: deps.fileExists,
      listFiles: deps.listFiles,
      existing: () => deps.repo.existing(),
    };
  }

  private progress(stage: ImportStage, done: number, total: number): void {
    this.deps.emit('import.progress', { stage, done, total });
  }

  /** An import (dry run or apply) is running. */
  running(): boolean {
    return this.busy;
  }

  /** Runs `work` unless a scan or another import is running (`BUSY`). */
  private async exclusive<T>(work: () => Promise<T>): Promise<T> {
    if (this.busy || this.deps.scan.status().running) fail('BUSY');
    this.busy = true;
    try {
      return await work();
    } finally {
      this.busy = false;
    }
  }

  dryRun(folder: string, emulatorsFolder: string | null): Promise<ImportReport> {
    return this.exclusive(() =>
      dryRun(folder, emulatorsFolder, this.planDeps(), (p) => {
        this.progress(p.stage, p.done, p.total);
      }),
    );
  }

  /** Applies the import; `token` is the dry run's, and a folder changed since is `CONFLICT`. */
  apply(folder: string, emulatorsFolder: string | null, token: string): Promise<ImportSummary> {
    return this.exclusive(async () => {
      const started = this.deps.clock().getTime();
      const plan = await planImport(folder, emulatorsFolder, this.planDeps());
      if (plan.fingerprint !== token) fail('CONFLICT', { reason: 'folderChanged' });
      const settingsBackupId = await this.applySettings(plan);
      const now = this.deps.clock();
      const written = this.deps.repo.upsertGames(plan.games, now, (done, total) => {
        this.progress('games', done, total);
      });
      const collectionIds = this.applyCollections(plan, now);
      await this.scanImported(plan.systemIds);
      const games = { ...written, missing: this.deps.repo.missingAmong(plan.games) };
      const menus = this.applyMenus(plan, collectionIds);
      this.deps.emit('library.changed', { systems: plan.systemIds });
      this.deps.emit('menus.changed', {});
      return {
        games,
        collections: plan.collections.length,
        menus,
        settingsBackupId,
        durationMs: Math.max(0, this.deps.clock().getTime() - started),
      };
    });
  }

  /**
   * Scans the imported systems for the games just written, adding no others, and waits for it. A
   * scan that was cancelled, failed, or wasn't this one (a scan started meanwhile) stops the import
   * before the menus: its games would show as missing until the next scan.
   */
  private async scanImported(systemIds: string[]): Promise<void> {
    this.progress('scan', 0, 1);
    const started = await this.deps.scan.start(systemIds, { addNew: false });
    const scanId = started.progress?.scanId;
    await this.deps.scan.whenIdle();
    const last = this.deps.scan.status().last;
    if (scanId === undefined || last?.scanId !== scanId || last.outcome !== 'completed') {
      fail('INTERNAL', {
        reason: 'scanIncomplete',
        outcome: last?.scanId === scanId ? (last?.outcome ?? null) : 'otherScan',
      });
    }
    this.progress('scan', 1, 1);
  }

  /** One settings write against the latest settings; skipped when nothing would change. */
  private async applySettings(plan: ImportPlan): Promise<string | null> {
    this.progress('settings', 0, 1);
    const { catalog, presets, newId } = this.deps;
    const next = (current: Settings) =>
      addSystemConfigs(
        addDetectedProfiles(
          mapSettings(plan.files, catalog, current, newId).next,
          plan.detected,
          catalog,
          presets,
          newId,
        ).next,
        plan.systemConfigs,
        newId,
      ).next;
    const current = this.currentSettings();
    if (isDeepStrictEqual(next(current), current)) {
      this.progress('settings', 1, 1);
      return null;
    }
    const before = await this.deps.latestBackupId();
    const result = await this.deps.settings.update(next);
    if (!result.ok) throw new AppErrorException(result.error);
    const after = await this.deps.latestBackupId();
    this.progress('settings', 1, 1);
    return after !== before ? after : null;
  }

  private applyCollections(plan: ImportPlan, now: Date): Map<string, number> {
    const ids = new Map<string, number>();
    plan.collections.forEach((collection, index) => {
      const id = this.deps.repo.upsertCollection(
        collection.source,
        collection.finalName,
        collection.entries,
        now,
      );
      ids.set(collection.name.toLowerCase(), id);
      this.progress('collections', index + 1, plan.collections.length);
    });
    return ids;
  }

  /** D12: imported menus are replaced in place; config.json's menu becomes the active one. */
  private applyMenus(plan: ImportPlan, collectionIds: ReadonlyMap<string, number>): number {
    let active: string | null = null;
    for (const [index, menu] of plan.menus.entries()) {
      const saved = this.deps.menus.upsertBySource(
        menu.source,
        menu.title,
        bindCollections(menu.nodes, collectionIds),
      );
      if (menu.active) active = saved.id;
      this.progress('menus', index + 1, plan.menus.length);
    }
    if (active) this.deps.menus.setActive(active);
    return plan.menus.length;
  }
}
