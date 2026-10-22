// The engine's loading and menu-failed states, shared by every theme. Only the content: the theme
// keeps rendering its own root `<div ref tabIndex>` so the DOM node its input listens on survives
// the switch to the ready state.
import { useTranslation } from 'react-i18next';
import { cn } from './cn.ts';

/** Classes a theme adds to its root while it shows the status content. */
export const MENU_STATUS_ROOT = 'flex flex-col items-center justify-center gap-4 text-sm';

export function MenuStatusContent({
  status,
  error,
  onRetry,
  onExit,
  titleClassName,
  buttonClassName,
}: {
  status: 'loading' | 'error' | 'ready';
  error?: string | undefined;
  onRetry: () => void;
  onExit: () => void;
  titleClassName?: string | undefined;
  buttonClassName?: string | undefined;
}) {
  const { t } = useTranslation();
  if (status === 'loading') return <span className="opacity-60">{t('themes.common.loading')}</span>;
  return (
    <>
      <span className={cn('text-2xl', titleClassName)}>{t('themes.common.menuFailed')}</span>
      {error && <span className="text-xs opacity-50">{error}</span>}
      <div className="flex gap-3">
        <button type="button" onClick={onRetry} className={buttonClassName}>
          {t('themes.common.retry')}
        </button>
        <button type="button" onClick={onExit} className={buttonClassName}>
          {t('themes.common.exit')}
        </button>
      </div>
    </>
  );
}
