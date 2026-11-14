import type { CatalogItem, DownloadGrant } from '@nextlevel/shared';
import { downloadFile } from './downloadFile.ts';

/** How an item's files ended: all there, or why the download pauses or fails. */
export type FilesOutcome =
  | { kind: 'done' }
  | { kind: 'pause'; reason: 'network' | 'hostLimit' }
  | { kind: 'fail'; reason: 'refused' | 'linkGone' }
  /** `grant` already paused or failed the download (offline, refused). */
  | { kind: 'stopped' };

/**
 * Downloads each file of an item into its `.part` (FR-CAT-4), one after another; an expired URL
 * is asked for once more with a new grant, a second refusal fails the download. A linked file's
 * host refusing it (FR-CAT-9) pauses `hostLimit` or fails `linkGone`, without a new grant.
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
      const issued = grant.files.find((one) => one.fileId === file.id);
      if (!issued) return { kind: 'fail', reason: 'refused' };
      const result = await downloadFile({
        url: issued.url,
        part: o.part(file.id),
        expectedSize: file.size,
        fetch: o.fetch,
        signal: o.signal,
        onBytes: o.onBytes,
        onRestart: o.onRestart,
        linked: issued.linked === true,
      });
      if (result === 'done') break;
      if (result === 'network') return { kind: 'pause', reason: 'network' };
      // FR-CAT-9: a linked file's host is busy or over its limit (no new grant), or the file left.
      if (result === 'hostLimit') return { kind: 'pause', reason: 'hostLimit' };
      if (result === 'gone') return { kind: 'fail', reason: 'linkGone' };
      if (renewed) return { kind: 'fail', reason: 'refused' };
      renewed = true;
      grant = await o.grant();
      if (!grant) return { kind: 'stopped' };
    }
  }
  return { kind: 'done' };
}
