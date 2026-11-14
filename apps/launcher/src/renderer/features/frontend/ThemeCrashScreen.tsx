import type { InputSettings } from '@nextlevel/shared';
import { useInputActions } from '@nextlevel/themes';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const BUTTON = 'rounded-lg px-4 py-2 text-sm font-semibold transition';

/**
 * The theme crashed (NFR-REL-2): restart it, switch to another theme or go back to the desktop —
 * the last two only when a locked kiosk doesn't hide them. Usable with a gamepad: left/right (or
 * up/down) pick a button, select runs it.
 */
export function ThemeCrashScreen({
  input,
  onRestart,
  onSwitchTheme,
  onDesktop,
}: {
  input: InputSettings;
  onRestart: () => void;
  onSwitchTheme?: (() => void) | undefined;
  onDesktop?: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const actions = [
    { label: t('frontend.crash.restart'), run: onRestart },
    ...(onSwitchTheme ? [{ label: t('frontend.crash.switch'), run: onSwitchTheme }] : []),
    ...(onDesktop ? [{ label: t('frontend.crash.desktop'), run: onDesktop }] : []),
  ];
  const [index, setIndex] = useState(0);
  const current = Math.min(index, actions.length - 1);

  useEffect(() => {
    ref.current?.focus();
  }, []);
  useInputActions({
    targetRef: ref,
    enabled: true,
    input,
    onAction: (action) => {
      if (action === 'left' || action === 'up') setIndex(Math.max(0, current - 1));
      else if (action === 'right' || action === 'down') {
        setIndex(Math.min(actions.length - 1, current + 1));
      } else if (action === 'select') actions[current]?.run();
    },
  });

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black">
      <div
        ref={ref}
        tabIndex={-1}
        role="alertdialog"
        aria-label={t('frontend.crash.title')}
        className="flex w-[32rem] flex-col gap-4 rounded-2xl border border-white/10 bg-[#11131a] p-6 text-white outline-none"
      >
        <h2 className="text-lg font-semibold">{t('frontend.crash.title')}</h2>
        <p className="text-sm text-slate-300">{t('frontend.crash.body')}</p>
        <div className="flex justify-end gap-2">
          {actions.map((action, i) => (
            <button
              key={action.label}
              type="button"
              tabIndex={-1}
              onClick={action.run}
              className={`${BUTTON} ${
                i === current ? 'bg-sky-500 text-white' : 'bg-white/10 text-slate-200'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
