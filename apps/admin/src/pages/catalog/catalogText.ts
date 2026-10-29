import { AppErrorException } from '@nextlevel/shared';
import { getSystem } from '@nextlevel/system-catalog';
import { errorKey } from '../../errors.ts';

// Wording helpers for the console's catalog pages (S13).

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

export const systemName = (id: string) => getSystem(id)?.name ?? id;

const REASONS = new Set([
  'slugTaken',
  'system',
  'scope',
  'lastFile',
  'type',
  'verified',
  'noEvidence',
  'noLicense',
  'blocked',
  'tooLarge',
  'checksum',
  'notUploaded',
]);

/** The API's refusal reason, when it sent one. */
export function reasonOf(error: unknown): string | null {
  if (!(error instanceof AppErrorException)) return null;
  const reason = (error.error.details as { reason?: unknown } | undefined)?.reason;
  return typeof reason === 'string' ? reason : null;
}

/** The i18n key for a refused catalog call: its reason's own wording, else the code's. */
export function catalogErrorKey(error: unknown): string {
  const reason = reasonOf(error);
  return reason && REASONS.has(reason) ? `admin.catalog.errors.${reason}` : errorKey(error);
}
