import type { BatchScope } from '@nextlevel/shared';
import { ImageDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MenuItem } from '../library/GameContextMenu.tsx';
import { useBatchStatus } from './batchApi.ts';

/** The batch rules dialog's state in the Library overlays (US-C6). */
export function useBatchOverlay() {
  const { t } = useTranslation();
  const status = useBatchStatus();
  // One job at a time: no new batch while one runs or is paused (or before the status is known).
  const canBatch = status.data?.state === 'idle' || status.data?.state === 'finished';
  const [batchRules, setBatchRules] = useState<{ scope: BatchScope; title: string } | null>(null);
  const titleOf = (scope: BatchScope, systemName: (id: string) => string) =>
    'systemIds' in scope
      ? scope.systemIds.map(systemName).join(', ')
      : t('library.batch.selectedTitle', { count: scope.gameIds.length });
  const openBatch = (scope: BatchScope, systemName: (id: string) => string = (id) => id) => {
    setBatchRules({ scope, title: titleOf(scope, systemName) });
  };
  return {
    batchRules,
    canBatch,
    openBatch,
    closeBatch: () => {
      setBatchRules(null);
    },
    /** "Scrape n selected games…" for the game context menu. */
    batchItem: (gameIds: readonly number[]): MenuItem => ({
      key: 'scrapeSelected',
      label: t('library.batch.selected', { count: gameIds.length }),
      icon: ImageDown,
      run: () => {
        openBatch({ gameIds: [...gameIds] });
      },
    }),
  };
}
