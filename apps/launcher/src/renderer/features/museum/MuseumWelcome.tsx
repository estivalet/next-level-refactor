import { artUrl } from '@nextlevel/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/** The owner's own picture, in the shared art folder next to the museum's system-info files. */
const PICTURE = 'system-info/museum.jpg';

/**
 * The top of the Museum's Home page (FR-MUS-9): a welcome over the owner's museum picture. The
 * picture is decorative; without it the banner keeps its text on a plain gradient.
 */
export function MuseumWelcome() {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  return (
    <header
      data-testid="museum-welcome"
      className="relative flex h-64 shrink-0 items-end overflow-hidden border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950/60"
    >
      {!failed && (
        <img
          src={artUrl({ kind: 'assets' }, PICTURE)}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => {
            setFailed(true);
          }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
      <div className="relative max-w-2xl px-6 py-5">
        <h2 className="text-3xl font-semibold text-slate-50">{t('apps.museum.welcome.title')}</h2>
        <p className="mt-2 text-sm text-slate-300">{t('apps.museum.welcome.intro')}</p>
      </div>
    </header>
  );
}
