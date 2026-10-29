import {
  AppErrorException,
  ERROR_CODES,
  safeFilename,
  safeSlug,
  type CatalogItem,
  type Settings,
  type StorageLocation,
  type SystemDefinition,
} from '@nextlevel/shared';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, rename, rm, rmdir, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative } from 'node:path';
import type { EmitEvent } from '../ipc/events.ts';
import { CatalogInstallRepository } from '../library/CatalogInstallRepository.ts';
import type { GameRepository } from '../library/GameRepository.ts';
import type { MediaRepository } from '../library/MediaRepository.ts';
import type { LibraryDb } from '../library/openLibrary.ts';
import { mediaDir, romStem } from '../scraper/mediaTarget.ts';
import type { MediaWriter } from '../scraper/MediaWriter.ts';
import type { ItemInstaller, VerifiedFile } from './types.ts';

export interface InstallerDeps {
  db: LibraryDb;
  games: Pick<GameRepository, 'applyScraped'>;
  media: Pick<MediaRepository, 'upsert'>;
  writer: Pick<MediaWriter, 'write'>;
  settings: () => Settings;
  /** The Catalog games folder, added to settings when missing (D45). */
  managedLocation: () => Promise<StorageLocation>;
  system: (id: string) => SystemDefinition | undefined;
  /** An art file by its signed media URL; null when it can't be had. */
  fetchArt: (url: string) => Promise<{ bytes: Buffer; format: string } | null>;
  clock: () => Date;
  emit: EmitEvent;
  log: { warn(context: object, msg: string): void };
}

const refused = (reason: string) =>
  new AppErrorException({
    code: 'VALIDATION_FAILED',
    message: ERROR_CODES.VALIDATION_FAILED,
    details: { reason },
  });

/** `path` is strictly inside `folder` (Review Focus 2). */
function inside(folder: string, path: string): boolean {
  const rel = relative(folder, path);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

/** Rename, or copy then delete across drives (data on C:, the Catalog folder on D:). */
async function move(from: string, to: string): Promise<void> {
  try {
    await rename(from, to);
  } catch (error) {
    if ((error as { code?: unknown }).code !== 'EXDEV') throw error;
    await copyFile(from, to);
    await rm(from, { force: true });
  }
}

const folderOf = (settings: Settings, system: SystemDefinition) =>
  settings.systems[system.id]?.folderName ?? system.defaultFolderName;

/**
 * Installs catalog items into the managed folder (FR-CAT-3, D45): `<location>\<system folder>\
 * <slug>\<filename>`, with metadata and art, and uninstalls them (FR-CAT-5). Everything from the
 * API is checked again here — slug, system and every filename — before a byte is written, even
 * if the API were compromised (Review Focus 2). Only files the installer recorded are deleted.
 */
export class Installer implements ItemInstaller {
  readonly #deps: InstallerDeps;
  readonly #installs: CatalogInstallRepository;

  constructor(deps: InstallerDeps) {
    this.#deps = deps;
    this.#installs = new CatalogInstallRepository(deps.db);
  }

  async install(item: CatalogItem, files: readonly VerifiedFile[]): Promise<{ gameId: number }> {
    const system = this.#deps.system(item.systemId);
    if (!system) throw refused('system');
    if (!safeSlug(item.slug)) throw refused('slug');
    for (const file of files) {
      const ok =
        file.role === 'extra'
          ? safeFilename(file.filename)
          : safeFilename(file.filename, system.extensions);
      if (!ok) throw refused('filename');
    }
    const main = files.find((file) => file.role !== 'extra');
    if (!main) throw refused('files');
    const settings = this.#deps.settings();
    const location = await this.#deps.managedLocation();
    const folder = folderOf(settings, system);
    const itemDir = join(location.path, folder, item.slug);
    if (!inside(location.path, itemDir)) throw refused('slug');
    for (const file of files) {
      if (!inside(itemDir, join(itemDir, file.filename))) throw refused('filename');
    }

    const previous = this.#installs.byItem(item.id);
    await mkdir(itemDir, { recursive: true });
    const written: string[] = [];
    for (const file of files) {
      await move(file.path, join(itemDir, file.filename));
      written.push([folder, item.slug, file.filename].join('/'));
    }
    if (previous) await this.#deleteFiles(previous, (rel) => !written.includes(rel));

    const relPath = `${item.slug}/${main.filename}`;
    const facts = await stat(join(itemDir, main.filename));
    const game = { systemId: item.systemId, locationId: location.id, relPath };
    const art = await this.#art(item, game, settings, system);
    const now = this.#deps.clock();
    const gameId = this.#deps.db.$client.transaction(() => {
      const id = this.#installs.write({
        gameId: previous?.gameId ?? this.#installs.gameAt(item.systemId, relPath) ?? null,
        ...game,
        size: facts.size,
        mtime: Math.trunc(facts.mtimeMs),
        title: item.title,
        itemId: item.id,
        version: item.version,
        files: written,
        onLapse: previous?.onLapse ?? 'keep',
        now: now.toISOString(),
      });
      this.#deps.games.applyScraped(
        id,
        {
          title: item.title,
          year: item.year,
          developer: item.developer || null,
          publisher: item.publisher || null,
          genre: item.genre || null,
          players: item.players === null ? null : String(item.players),
          description: item.description || null,
        },
        { overrideLocked: [] },
        now,
      );
      for (const row of art) this.#deps.media.upsert({ gameId: id, ...row });
      return id;
    })();
    this.#deps.emit('library.changed', { systems: [item.systemId], gameIds: [gameId] });
    return { gameId };
  }

  /**
   * Deletes the item's recorded files, then its library entry — unless a local copy is at the
   * same path in another location, which then becomes a local game again (Review Focus 4).
   * A favorite or a collection member needs `confirm` (US-E3).
   */
  async uninstall(itemId: string, confirm: boolean): Promise<void> {
    const install = this.#installs.byItem(itemId);
    if (!install) {
      throw new AppErrorException({ code: 'NOT_FOUND', message: ERROR_CODES.NOT_FOUND });
    }
    if (!confirm && this.#installs.isKept(install.gameId)) {
      throw new AppErrorException({
        code: 'CONFLICT',
        message: ERROR_CODES.CONFLICT,
        details: { reason: 'inCollections' },
      });
    }
    await this.#deleteFiles(install, () => true);
    const settings = this.#deps.settings();
    const system = this.#deps.system(install.systemId);
    const folder = system ? folderOf(settings, system) : install.systemId;
    const localCopy = settings.storage.locations.find(
      (location) =>
        location.id !== install.locationId &&
        existsSync(join(location.path, folder, ...install.relPath.split('/'))),
    );
    if (localCopy) this.#installs.toLocal(install.gameId, localCopy.id);
    else this.#installs.removeGame(install.gameId);
    this.#deps.emit('library.changed', { systems: [install.systemId], gameIds: [install.gameId] });
  }

  /** Deletes recorded files inside their location (never anything else), then empty folders. */
  async #deleteFiles(
    install: { files: string[]; locationId: string },
    which: (rel: string) => boolean,
  ): Promise<void> {
    const location = this.#deps
      .settings()
      .storage.locations.find((candidate) => candidate.id === install.locationId);
    if (!location) return;
    const folders = new Set<string>();
    for (const rel of install.files.filter(which)) {
      const path = join(location.path, ...rel.split('/'));
      if (!inside(location.path, path)) continue;
      await rm(path, { force: true });
      folders.add(dirname(path));
    }
    for (const folder of folders) await rmdir(folder).catch(() => undefined);
  }

  /** Downloads and writes the item's art (FR-SCR-4 layout); a failure is logged and skipped. */
  async #art(
    item: CatalogItem,
    game: { systemId: string; locationId: string; relPath: string },
    settings: Settings,
    system: SystemDefinition,
  ) {
    const dir = mediaDir(game, settings, system);
    const rows: Array<{ kind: string; path: string; size: number; version: number }> = [];
    if (!dir) return rows;
    for (const media of item.media) {
      try {
        const fetched = await this.#deps.fetchArt(media.url);
        if (!fetched) continue;
        const written = await this.#deps.writer.write(
          dir,
          media.kind,
          romStem(game.relPath),
          fetched.bytes,
          fetched.format,
        );
        rows.push({
          kind: media.kind,
          path: written.path,
          size: written.size,
          version: written.version,
        });
      } catch (error) {
        this.#deps.log.warn({ itemId: item.id, kind: media.kind, error }, 'catalog art skipped');
      }
    }
    return rows;
  }
}
