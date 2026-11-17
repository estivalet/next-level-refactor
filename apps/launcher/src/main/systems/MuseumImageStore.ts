import { copyFile, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { basename, extname, join, resolve, sep } from 'node:path';
import {
  MUSEUM_IMAGE_EXTENSIONS,
  MUSEUM_IMAGE_FILE,
  MUSEUM_IMAGE_MAX_BYTES,
  SYSTEM_ID,
  type RejectedImage,
  type SystemGalleryImage,
} from '@nextlevel/shared';

type Fs = {
  copyFile: typeof copyFile;
  mkdir: typeof mkdir;
  readdir: typeof readdir;
  rename: typeof rename;
  rm: typeof rm;
  stat: typeof stat;
};

export interface MuseumImageStoreDeps {
  /** `<dataDir>/museum` */
  root: string;
  /** A fresh uuid; file names are `<uuid>.<ext>`. */
  newId: () => string;
  fs?: Partial<Fs>;
  log?: { warn(context: object, msg: string): void };
}

/**
 * The owner's gallery images, copied into `<root>/<systemId>/<uuid>.<ext>` (FR-MUS-8). The
 * original file is never referenced afterwards. Both path segments are validated before any
 * file access, so nothing resolves outside the system's folder.
 */
export class MuseumImageStore {
  private readonly fs: Fs;

  constructor(private readonly deps: MuseumImageStoreDeps) {
    this.fs = { copyFile, mkdir, readdir, rename, rm, stat, ...deps.fs };
  }

  async add(
    systemId: string,
    sources: readonly string[],
  ): Promise<{ added: SystemGalleryImage[]; rejected: RejectedImage[] }> {
    const added: SystemGalleryImage[] = [];
    const rejected: RejectedImage[] = [];
    const folder = this.folder(systemId);
    for (const source of sources) {
      const name = basename(source);
      const ext = extname(source).slice(1).toLowerCase();
      if (!(MUSEUM_IMAGE_EXTENSIONS as readonly string[]).includes(ext)) {
        rejected.push({ name, reason: 'type' });
        continue;
      }
      try {
        const info = await this.fs.stat(source);
        if (!info.isFile()) throw new Error('not a file');
        if (info.size > MUSEUM_IMAGE_MAX_BYTES) {
          rejected.push({ name, reason: 'size' });
          continue;
        }
        if (!folder) throw new Error('invalid system id');
        await this.fs.mkdir(folder, { recursive: true });
        const file = `${this.deps.newId()}.${ext}`;
        const target = join(folder, file);
        const temp = `${target}.tmp`;
        try {
          await this.fs.copyFile(source, temp);
          await this.fs.rename(temp, target);
        } catch (error) {
          await this.fs.rm(temp, { force: true }).catch(() => undefined);
          throw error;
        }
        added.push({ file });
      } catch {
        rejected.push({ name, reason: 'unreadable' });
      }
    }
    return { added, rejected };
  }

  /** The stored file's path, or null when the names are invalid or the file is missing. */
  async path(systemId: string, file: string): Promise<string | null> {
    const folder = this.folder(systemId);
    if (!folder || !MUSEUM_IMAGE_FILE.test(file)) return null;
    const target = resolve(folder, file);
    if (!target.startsWith(folder + sep)) return null;
    try {
      return (await this.fs.stat(target)).isFile() ? target : null;
    } catch {
      return null;
    }
  }

  /** Deletes every stored image of the system that is not in `files`. Errors are logged. */
  async keepOnly(systemId: string, files: readonly string[]): Promise<void> {
    const folder = this.folder(systemId);
    if (!folder) return;
    let names: string[];
    try {
      names = await this.fs.readdir(folder);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.deps.log?.warn({ systemId, error }, 'museum gallery cleanup failed');
      }
      return;
    }
    const keep = new Set(files);
    for (const name of names) {
      // `.tmp` is an add in progress; it renames itself or removes itself on failure.
      if (keep.has(name) || name.endsWith('.tmp')) continue;
      try {
        await this.fs.rm(join(folder, name), { force: true });
      } catch (error) {
        this.deps.log?.warn({ systemId, error }, 'museum gallery cleanup could not remove a file');
      }
    }
  }

  private folder(systemId: string): string | null {
    return SYSTEM_ID.test(systemId) ? resolve(this.deps.root, systemId) : null;
  }
}
