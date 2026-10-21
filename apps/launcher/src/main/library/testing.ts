import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LibraryRepository } from './LibraryRepository.ts';
import { openLibrary } from './openLibrary.ts';

/** A temp folder; cleanup retries because Windows can hold SQLite files briefly. */
export async function tempDir(prefix = 'nextlevel-library-') {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  return {
    dir,
    cleanup: () => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }),
  };
}

/** A fresh `library.db` in a temp folder, with its repository. */
export async function tempLibrary() {
  const temp = await tempDir();
  const db = openLibrary(join(temp.dir, 'library.db'), {
    backupsDir: join(temp.dir, 'backups'),
    clock: () => new Date(Date.UTC(2026, 9, 21, 12, 0, 0)),
  });
  return {
    dir: temp.dir,
    db,
    repo: new LibraryRepository(db),
    cleanup: async () => {
      db.$client.close();
      await temp.cleanup();
    },
  };
}
