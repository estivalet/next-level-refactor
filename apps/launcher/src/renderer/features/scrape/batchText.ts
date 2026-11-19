import type { BatchStatus } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import { useSystemCatalog } from '../settings/settingsApi.ts';
import type { BatchKind } from './batchApi.ts';
import { scopeLabel } from './batchScope.ts';

/** A date and time short enough for the strip ("17 Nov, 21:04"). */
export function shortDateTime(iso: string, language: string): string {
  return new Date(iso).toLocaleString(language, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * A batch job's one-line summary (US-C6, FR-SCR-8): "Scraping <scope> n/m · …", why it paused, or
 * the finished counts, with "· n from LaunchBox" (FR-SCR-6). Empty when idle.
 */
export function useBatchLine(status: BatchStatus, kind: BatchKind = 'scrape') {
  const { t, i18n } = useTranslation();
  const catalog = useSystemCatalog();
  const nameOf = (id: string) => catalog.data?.find((system) => system.id === id)?.name ?? id;
  const texts = kind === 'gemini' ? 'library.geminiBatch' : 'library.batch';
  const done = Math.min(status.done, status.total);
  const counts = {
    done,
    total: status.total,
    applied: status.applied,
    scope: scopeLabel(status.systemIds, nameOf, t),
  };
  const fromLaunchBox =
    status.launchbox > 0 ? t('library.batch.fromLaunchBox', { count: status.launchbox }) : '';
  const time = status.resumeAt
    ? new Date(status.resumeAt).toLocaleTimeString(i18n.language, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  const line =
    status.state === 'idle'
      ? ''
      : status.state === 'finished'
        ? t(`${texts}.finished`, { ...status, count: done }) + fromLaunchBox
        : status.state === 'running'
          ? t(`${texts}.running`, { ...counts, review: status.review }) + fromLaunchBox
          : t(`${texts}.paused.${status.pausedReason ?? 'user'}`, { ...counts, time });
  return { line, scope: counts.scope };
}
