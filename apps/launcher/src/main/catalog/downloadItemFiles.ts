import type { CatalogItem, DownloadGrant } from '@nextlevel/shared';
import { downloadFile } from './downloadFile.ts';

/** How an item's files ended: all there, or why the download pauses or fails. */
export type FilesOutcome =
  | { kind: 'done' }
  | { kind: 'pause'; reason: 'network' }
  | { kind: 'fail'; reason: 'refused' }
  /** `grant` already paused or failed the download (offline, refused). */
  | { kind: 'stopped' };

/**
 * Downloads each file of an item into its `.part` (FR-CAT-4), one after another; an expired URL
 * is asked for once more with a new grant, a second refusal fails the download.
 */
export async function downloadItemFiles(o: {
  files: CatalogItem['files'];
  part: (fileId: string) => string;
  fetch: typeof fetch;
  signal: AbortSignal;
  grant: () => Promise<DownloadGrant | null>;
  onBytes: (count: number) => void;
  onRestart: (dropped: number) => void;
}): Promise<FilesOutcome> {
  let grant = await o.grant();
  if (!grant) return { kind: 'stopped' };
  for (const file of o.files) {
    let renewed = false;
    for (;;) {
      const url = grant.files.find((issued) => issued.fileId === file.id)?.url;
      if (!url) return { kind: 'fail', reason: 'refused' };
      const result = await downloadFile({
        url,
        part: o.part(file.id),
        expectedSize: file.size,
        fetch: o.fetch,
        signal: o.signal,
        onBytes: o.onBytes,
        onRestart: o.onRestart,
      });
      if (result === 'done') break;
      if (result === 'network') return { kind: 'pause', reason: 'network' };
      if (renewed) return { kind: 'fail', reason: 'refused' };
      renewed = true;
      grant = await o.grant();
      if (!grant) return { kind: 'stopped' };
    }
  }
  return { kind: 'done' };
}
