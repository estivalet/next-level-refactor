import type { ScanSystemResult } from '@nextlevel/shared';
import type { SystemDiff } from '../library/LibraryRepository.ts';

/** One system's line in the scan summary. */
export function systemResult(systemId: string, diff: SystemDiff): ScanSystemResult {
  return {
    systemId,
    present: diff.added.length + diff.present.length + diff.moved.length,
    added: diff.added.length,
    moved: diff.moved.length,
    restored: diff.restored.length,
    missing: diff.missing.length,
  };
}

/** Whether a scan changed what the library shows for a system (new, moved, restored, missing). */
export function changesLibrary(result: ScanSystemResult): boolean {
  return result.added + result.moved + result.restored + result.missing > 0;
}
