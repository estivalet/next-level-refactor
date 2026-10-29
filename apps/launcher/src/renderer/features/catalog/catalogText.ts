import { AppErrorException, type CatalogListItem, type DownloadSummary } from '@nextlevel/shared';
import type { TFunction } from 'i18next';

// Wording helpers for the Catalog app (S8).

/** 8192 → "8 KB" (binary units, one decimal at most). */
export function formatBytes(bytes: number, language: string): string {
  const units = ['B', 'KB', 'MB', 'GB'] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const number = new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value);
  return `${number} ${units[unit] ?? 'B'}`;
}

export const percentOf = (download: Pick<DownloadSummary, 'bytesDone' | 'bytesTotal'>) =>
  download.bytesTotal > 0
    ? Math.min(100, Math.floor((download.bytesDone / download.bytesTotal) * 100))
    : 0;

/** What a card says about the item on this PC. */
export function stateText(
  t: TFunction,
  item: Pick<CatalogListItem, 'installState'>,
  download: DownloadSummary | undefined,
): string {
  switch (item.installState) {
    case 'downloading':
      return t('catalog.state.downloading', { percent: download ? percentOf(download) : 0 });
    case 'failed':
      return download?.error === 'checksum'
        ? t('catalog.state.corrupted')
        : t('catalog.state.failed');
    default:
      return t(`catalog.state.${item.installState}`);
  }
}

export function reasonOf(error: unknown): string | null {
  if (!(error instanceof AppErrorException)) return null;
  const reason = (error.error.details as { reason?: unknown } | undefined)?.reason;
  return typeof reason === 'string' ? reason : null;
}

export const isOffline = (error: unknown) =>
  error instanceof AppErrorException && error.error.code === 'API_UNREACHABLE';
