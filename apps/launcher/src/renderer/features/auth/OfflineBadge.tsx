import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthState } from './authApi.ts';

/** US-A3: running on the offline grace; the tooltip says until when. */
export function OfflineBadge({ className = '' }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const state = useAuthState().data;
  if (state?.kind !== 'signedIn' || !state.offline) return null;
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
    new Date(state.entitlement.offlineUntil),
  );
  return (
    <span
      title={t('auth.offlineUntil', { date })}
      className={`flex items-center gap-1 rounded-full bg-amber-300/15 px-2 py-0.5 text-[11px] text-amber-100 ${className}`}
    >
      <WifiOff aria-hidden="true" className="h-3 w-3" />
      <span>{t('auth.offline')}</span>
    </span>
  );
}
