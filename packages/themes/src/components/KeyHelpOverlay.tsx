// Ported from NextLevelOS src/themes/components/KeyHelpOverlay.tsx @ 3d530b7: generated from the
// theme's keymap and the user's bindings, so it shows their key and button for every intent.
import type { InputAction, InputSettings } from '@nextlevel/shared';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { describeKeymap } from '../engine/intentLabels.ts';
import type { KeyMap, NavIntentKind } from '../engine/types.ts';
import { useInputActions } from '../input/useInputActions.ts';
import { cn } from './cn.ts';
import type { Hint } from './HintBar.tsx';

const CLOSE_ACTIONS = new Set<InputAction>(['back', 'help', 'select', 'menu']);

/**
 * The full key and button reference. The theme pauses its own input while `open`; back, help,
 * select or menu (or a click outside) closes it.
 */
export function KeyHelpOverlay({
  open,
  enabled = true,
  onClose,
  keymap,
  input,
  intents,
  extra = [],
  className,
  panelClassName,
  keyClassName,
}: {
  open: boolean;
  /** False while the theme behind it takes no input (e.g. the front-end is hidden). */
  enabled?: boolean;
  onClose: () => void;
  keymap: KeyMap;
  input: InputSettings;
  intents?: readonly NavIntentKind[];
  extra?: Hint[];
  className?: string;
  panelClassName?: string;
  keyClassName?: string;
}) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  // Also when input comes back (an overlay above it closed): focus would be left on the body.
  useEffect(() => {
    if (open && enabled) panelRef.current?.focus();
  }, [open, enabled]);
  useInputActions({
    targetRef: panelRef,
    enabled: open && enabled,
    input,
    onAction: (action) => {
      if (CLOSE_ACTIONS.has(action)) onClose();
    },
  });
  if (!open) return null;

  const rows = describeKeymap(keymap, input, intents).map((row) => ({
    keys: [...row.keys, ...row.buttons],
    label: t(row.labelKey),
  }));

  return (
    <div
      className={cn('absolute inset-0 z-40 flex items-center justify-center', className)}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label={t('themes.help.title')}
        className={cn('outline-none', panelClassName)}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <h2 className="mb-4 text-lg font-semibold">{t('themes.help.title')}</h2>
        <dl className="min-w-72">
          {[...rows, ...extra].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-10 py-1.5">
              <dt className="flex gap-1.5">
                {row.keys.map((key) => (
                  <kbd key={key} className={keyClassName}>
                    {key}
                  </kbd>
                ))}
              </dt>
              <dd>{row.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
