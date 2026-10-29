import {
  defaultSettings,
  type CatalogItem,
  type Settings,
  type StorageLocation,
} from '@nextlevel/shared';
import { getSystem } from '@nextlevel/system-catalog';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GameRepository } from '../library/GameRepository.ts';
import { MediaRepository } from '../library/MediaRepository.ts';
import { tempDir, tempLibrary } from '../library/testing.ts';
import { MediaWriter } from '../scraper/MediaWriter.ts';
import { Installer } from './Installer.ts';
import { catalogItem } from './testing.ts';
import type { VerifiedFile } from './types.ts';

export const LOCAL_ID = '0192f000-0000-7000-8000-0000000000a1';
export const MANAGED_ID = '0192f000-0000-7000-8000-0000000000a2';

/**
 * The Installer over a temp library: a local location and the managed Catalog folder (both temp
 * folders), and parts written where a download would leave them.
 */
export async function installWorld(closers: Array<() => Promise<void>>) {
  const library = await tempLibrary();
  const temp = await tempDir('nextlevel-install-');
  closers.push(library.cleanup, temp.cleanup);
  const local: StorageLocation = {
    id: LOCAL_ID,
    name: 'ROMs',
    path: join(temp.dir, 'roms'),
    priority: 1,
  };
  let managed: StorageLocation = {
    id: MANAGED_ID,
    name: 'Catalog',
    path: join(temp.dir, 'Catalog'),
    priority: 2,
    managed: true,
  };
  const base = defaultSettings();
  let settings: Settings = {
    ...base,
    storage: { ...base.storage, locations: [local, managed] },
  };
  const changed: unknown[] = [];
  const art = new Map<string, Buffer>();
  const installer = new Installer({
    db: library.db,
    games: new GameRepository(library.db, () => ({ path: '', missing: false }) as never),
    media: new MediaRepository(library.db),
    writer: new MediaWriter({ toPng: (bytes) => bytes }),
    settings: () => settings,
    managedLocation: () => Promise.resolve(managed),
    system: getSystem,
    fetchArt: (url) => {
      const bytes = art.get(url);
      return Promise.resolve(bytes ? { bytes, format: 'png' } : null);
    },
    clock: () => new Date('2026-10-29T10:00:00.000Z'),
    emit: (_event, payload) => changed.push(payload),
    log: { warn: () => undefined },
  });
  let parts = 0;

  /** Writes each file's bytes as a verified part and answers what the download hands over. */
  const download = async (item: CatalogItem, bodies: Record<string, Buffer>) => {
    const dir = join(temp.dir, 'downloads', String((parts += 1)));
    await mkdir(dir, { recursive: true });
    const files: VerifiedFile[] = [];
    for (const file of item.files) {
      const bytes = bodies[file.filename] ?? Buffer.from(`dummy ${file.filename}`);
      const path = join(dir, `${file.id}.part`);
      await writeFile(path, bytes);
      files.push({
        fileId: file.id,
        filename: file.filename,
        role: file.role,
        path,
        size: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
    return files;
  };

  const row = (sql: string, ...args: unknown[]): unknown =>
    library.db.$client.prepare(sql).get(...args);
  const rows = (sql: string, ...args: unknown[]): unknown[] =>
    library.db.$client.prepare(sql).all(...args);

  /** Settings → Storage → Change folder: the old Catalog folder stays as an ordinary location. */
  const moveCatalog = (path: string) => {
    const old = { ...managed, name: 'Catalog (old)', managed: false };
    managed = {
      id: '0192f000-0000-7000-8000-0000000000a3',
      name: 'Catalog',
      path,
      priority: 3,
      managed: true,
    };
    settings = { ...settings, storage: { ...settings.storage, locations: [local, old, managed] } };
    return old;
  };

  return {
    moveCatalog,
    db: library.db,
    repo: library.repo,
    installer,
    local,
    managed,
    settings,
    changed,
    art,
    download,
    row,
    rows,
    item: catalogItem,
    nesFolder: getSystem('nintendo-nes')?.defaultFolderName ?? 'nes',
  };
}
