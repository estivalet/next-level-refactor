import type { NextLevelBridge } from '@nextlevel/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type VersionState = { status: 'loading' } | { status: 'ok'; version: string } | { status: 'error' };

export function App({ bridge }: { bridge: NextLevelBridge }) {
  const { t } = useTranslation();
  const [version, setVersion] = useState<VersionState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    bridge
      .invoke('app.version')
      .then((result) => {
        if (cancelled) return;
        setVersion(result.ok ? { status: 'ok', version: result.value } : { status: 'error' });
      })
      .catch(() => {
        if (!cancelled) setVersion({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [bridge]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-900 text-slate-100">
      <h1 className="text-5xl font-bold">{t('hello.title')}</h1>
      {version.status === 'ok' && <p>{t('hello.version', { version: version.version })}</p>}
      {version.status === 'error' && <p>{t('hello.versionUnavailable')}</p>}
    </main>
  );
}
