import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRestartToUpdate, useUpdateState } from '../update/updateApi.ts';

/**
 * A downloaded update in the tray (D53): a click restarts NextLevel into it. Hidden otherwise —
 * the update also installs on its own when NextLevel closes.
 */
export function TrayUpdate() {
  const { t } = useTranslation();
  const state = useUpdateState().data;
  const restart = useRestartToUpdate();
  if (state?.kind !== 'ready') return null;
  const label = t('update.trayRestart', { version: state.version });
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={restart.isPending}
      onClick={() => {
        restart.mutate();
      }}
      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-emerald-200 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
    >
      <RefreshCw aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}
