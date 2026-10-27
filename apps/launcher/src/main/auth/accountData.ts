import type { ApiClient } from './ApiClient.ts';
import type { AuthService } from './AuthService.ts';

const pad = (n: number) => String(n).padStart(2, '0');

/** `nextlevel-data-YYYY-MM-DD.json`, on this PC's date. */
export function exportFileName(now: Date): string {
  return `nextlevel-data-${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

/**
 * Download my data (security §5, D36): fetch the export, ask where to save it (the Save dialog
 * runs in main; the renderer only learns whether it was saved), write it atomically.
 */
export async function exportAccountData(deps: {
  auth: Pick<AuthService, 'accessCall'>;
  api: Pick<ApiClient, 'exportData'>;
  pickPath: (defaultName: string) => Promise<string | null>;
  write: (file: string, data: string) => Promise<void>;
  clock: () => Date;
}): Promise<{ saved: boolean }> {
  const data = await deps.auth.accessCall((token) => deps.api.exportData(token));
  const file = await deps.pickPath(exportFileName(deps.clock()));
  if (!file) return { saved: false };
  await deps.write(file, `${JSON.stringify(data, null, 2)}\n`);
  return { saved: true };
}
