import { AppErrorException, ERROR_CODES } from '@nextlevel/shared';
import type Database from 'better-sqlite3';
import { notFound } from './libraryErrors.ts';

interface FileRow {
  id: number;
  systemId: string;
  missing: number;
  relPath: string;
  locationId: string | null;
  size: number;
  mtime: number;
  discGroup: string | null;
}

type RelinkRefusal = 'same' | 'notMissing' | 'replacementMissing' | 'otherSystem';

function refuseRelink(reason: RelinkRefusal): AppErrorException {
  return new AppErrorException({
    code: 'VALIDATION_FAILED',
    message: ERROR_CODES.VALIDATION_FAILED,
    details: { reason },
  });
}

/**
 * Moves a missing game onto another game's file (FR-LIB-3, owner decision 2026-10-21): the
 * missing row keeps its id, metadata, flags and collections; the other row is deleted.
 */
export function relinkGame(
  client: Database.Database,
  missingGameId: number,
  replacementGameId: number,
): void {
  client.transaction(() => {
    const read = client.prepare(
      `select id, system_id as systemId, missing, rel_path as relPath, location_id as locationId,
         size, mtime, disc_group as discGroup from games where id = ?`,
    );
    const missing = read.get(missingGameId) as FileRow | undefined;
    const replacement = read.get(replacementGameId) as FileRow | undefined;
    if (!missing || !replacement) throw notFound({ missingGameId, replacementGameId });
    if (missing.id === replacement.id) throw refuseRelink('same');
    if (missing.missing !== 1) throw refuseRelink('notMissing');
    if (replacement.missing === 1) throw refuseRelink('replacementMissing');
    if (missing.systemId !== replacement.systemId) throw refuseRelink('otherSystem');
    // Delete first: the rel_path is unique per system.
    client.prepare('delete from games where id = ?').run(replacement.id);
    client
      .prepare(
        `update games set rel_path = @relPath, location_id = @locationId, size = @size,
           mtime = @mtime, disc_group = @discGroup, missing = 0, missing_since = null
         where id = @id`,
      )
      .run({ ...replacement, id: missing.id });
  })();
}
