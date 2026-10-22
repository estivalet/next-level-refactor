// Ported from NextLevelOS src/themes/components/ThemeExitMenu.tsx @ 3d530b7: driven by input
// actions, so a gamepad works it too (US-C1), with the user's keys shown on each entry.
import { bindingLabel, type InputAction, type InputSettings } from '@nextlevel/shared';
import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInputActions } from '../input/useInputActions.ts';
import { cn } from './cn.ts';

type ActionId = 'desktop' | 'switch' | 'resume';

const ENTRIES: { id: ActionId; labelKey: string; shortcut: InputAction }[] = [
  { id: 'desktop', labelKey: 'themes.exitMenu.desktop', shortcut: 'toDesktop' },
  { id: 'switch', labelKey: 'themes.exitMenu.switch', shortcut: 'switchTheme' },
  { id: 'resume', labelKey: 'themes.exitMenu.resume', shortcut: 'back' },
];

/**
 * The theme menu (IA: back at the root): Desktop · Switch theme · Resume. Its keys never reach
 * the theme or the shell behind it. Without `onSwitchTheme` the switch entry is left out.
 */
export function ThemeExitMenu({
  input,
  onDesktop,
  onSwitchTheme,
  onClose,
}: {
  input: InputSettings;
  onDesktop: () => void;
  onSwitchTheme?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const entries = ENTRIES.filter((entry) => entry.id !== 'switch' || onSwitchTheme);
  const [index, setIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.focus();
    const stop = (event: KeyboardEvent) => {
      event.stopPropagation();
    };
    dialog.addEventListener('keydown', stop);
    return () => {
      dialog.removeEventListener('keydown', stop);
    };
  }, []);

  const run = (id: ActionId | undefined) => {
    if (id === 'desktop') onDesktop();
    else if (id === 'switch') onSwitchTheme?.();
    else onClose();
  };
  const move = (step: number) => {
    setIndex((i) => (i + step + entries.length) % entries.length);
  };

  useInputActions({
    targetRef: ref,
    enabled: true,
    input,
    onAction: (action) => {
      if (action === 'up' || action === 'left') move(-1);
      else if (action === 'down' || action === 'right') move(1);
      else if (action === 'select') run(entries[index]?.id);
      else if (action === 'back' || action === 'menu') onClose();
      else if (action === 'toDesktop') onDesktop();
      else if (action === 'switchTheme') onSwitchTheme?.();
    },
  });

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-label={t('themes.exitMenu.label')}
      className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 outline-none backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-80 flex-col gap-2 p-6"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        {entries.map((entry, i) => {
          const key = input.keyboard[entry.shortcut][0];
          return (
            <button
              key={entry.id}
              type="button"
              tabIndex={-1}
              aria-pressed={i === index}
              onClick={() => {
                run(entry.id);
              }}
              onMouseEnter={() => {
                setIndex(i);
              }}
              className={cn(
                'flex items-center justify-between rounded-xl border px-5 py-3 text-left text-white transition',
                i === index ? 'scale-105 border-white bg-white/20' : 'border-white/10 bg-white/5',
              )}
            >
              <span className="font-semibold">{t(entry.labelKey)}</span>
              {key && (
                <kbd className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/70">
                  {bindingLabel('keyboard', key)}
                </kbd>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
