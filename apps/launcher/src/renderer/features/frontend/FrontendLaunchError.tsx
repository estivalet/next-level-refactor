import type { InputSettings } from '@nextlevel/shared';
import { useInputActions } from '@nextlevel/themes';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LaunchErrorDetails, launchDetails } from '../launch/LaunchErrorDetails.tsx';
import { useGameDetails } from '../library/libraryApi.ts';
import type { FrontendFailure } from './useFrontendSession.ts';

const BUTTON = 'rounded-lg px-4 py-2 text-sm font-semibold transition';

/**
 * Why a Play from the front-end failed and the setting that fixes it (US-C2), usable with a
 * gamepad: left/right pick a button, select runs it, back closes.
 */
export function FrontendLaunchError({
  failure,
  input,
  onFix,
  onClose,
}: {
  failure: FrontendFailure;
  input: InputSettings;
  onFix: (fix: { section: string; id?: string | undefined }) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const title = useGameDetails(failure.gameId).data?.title;
  const { fix, exitCode, stderrTail } = launchDetails(failure.error);
  const actions = [
    ...(fix
      ? [
          {
            label: t('library.launchError.fix'),
            run: () => {
              onFix(fix);
            },
          },
        ]
      : []),
    { label: t('library.launchError.close'), run: onClose },
  ];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    ref.current?.focus();
  }, []);
  useInputActions({
    targetRef: ref,
    enabled: true,
    input,
    onAction: (action) => {
      if (action === 'left' || action === 'up') setIndex((i) => Math.max(0, i - 1));
      else if (action === 'right' || action === 'down') {
        setIndex((i) => Math.min(actions.length - 1, i + 1));
      } else if (action === 'select') actions[index]?.run();
      else if (action === 'back' || action === 'menu') onClose();
    },
  });

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/70">
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-label={
          title ? t('library.launchError.title', { title }) : t('library.launchError.untitled')
        }
        className="flex w-[32rem] flex-col gap-4 rounded-2xl border border-white/10 bg-[#11131a] p-6 text-white outline-none"
      >
        <h2 className="text-lg font-semibold">
          {title ? t('library.launchError.title', { title }) : t('library.launchError.untitled')}
        </h2>
        <LaunchErrorDetails error={failure.error} />
        {exitCode !== undefined && (
          <p className="text-xs text-slate-300">
            {t('library.launchError.exitCode', { code: exitCode })}
          </p>
        )}
        {stderrTail && (
          <pre className="max-h-40 overflow-auto rounded-lg bg-black/40 p-3 text-xs whitespace-pre-wrap text-slate-300">
            {stderrTail}
          </pre>
        )}
        <div className="flex justify-end gap-2">
          {actions.map((action, i) => (
            <button
              key={action.label}
              type="button"
              tabIndex={-1}
              aria-pressed={i === index}
              onClick={action.run}
              onMouseEnter={() => {
                setIndex(i);
              }}
              className={`${BUTTON} ${i === index ? 'bg-white text-black' : 'bg-white/10 text-white'}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
