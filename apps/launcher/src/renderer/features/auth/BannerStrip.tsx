import { X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthState } from './authApi.ts';

/** The operator's maintenance banner in the desktop shell (D28); dismissed until its text changes. */
export function BannerStrip() {
  const { t } = useTranslation();
  const state = useAuthState().data;
  const banner = state?.kind === 'signedIn' ? state.banner : null;
  const [dismissed, setDismissed] = useState<string | null>(null);
  if (!banner || banner === dismissed) return null;
  return (
    <div
      role="note"
      className="flex shrink-0 items-center gap-3 border-b border-amber-300/20 bg-amber-300/10 px-4 py-1.5 text-xs text-amber-100"
    >
      <p className="flex-1">{banner}</p>
      <button
        type="button"
        aria-label={t('auth.bannerDismiss')}
        className="rounded p-0.5 hover:bg-white/10"
        onClick={() => {
          setDismissed(banner);
        }}
      >
        <X aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
