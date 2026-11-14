import { defaultSettings } from '@nextlevel/shared';
import { useInputActions } from '@nextlevel/themes';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

// The default bindings: whatever crashed the renderer may be the saved settings themselves.
const INPUT = defaultSettings().input;

const reloadWindow = () => {
  window.location.reload();
};

/**
 * The whole renderer crashed (NFR-REL-2): reload it; main and the library keep running. Select on
 * a gamepad (or Enter) reloads too, so a cabinet without a mouse is never stuck here.
 */
export function ShellCrash({ onReload = reloadWindow }: { onReload?: () => void }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  // Keys are read from the screen itself (one Enter, one reload): it holds the focus.
  useEffect(() => {
    ref.current?.focus();
  }, []);
  useInputActions({
    targetRef: ref,
    enabled: true,
    input: INPUT,
    onAction: (action) => {
      if (action === 'select') onReload();
    },
  });
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#11131a] text-white outline-none"
    >
      <h1 className="text-lg font-semibold">{t('shell.crash.title')}</h1>
      <button
        type="button"
        tabIndex={-1}
        onClick={onReload}
        className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold hover:bg-sky-500"
      >
        {t('shell.crash.reload')}
      </button>
    </div>
  );
}
