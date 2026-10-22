// Ported from NextLevelOS src/themes/ThemeSwitcher.tsx @ 3d530b7: driven by input actions so a
// gamepad works it too (US-C1), names via i18n, and one card per bundled theme (D6, no "All
// themes…" card). Its keys never reach the theme or the shell behind it.
import type { InputSettings } from '@nextlevel/shared';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInputActions } from '../input/useInputActions.ts';
import { cn } from './cn.ts';

export interface ThemeSwitcherOption {
  id: string;
  nameKey: string;
  descriptionKey?: string | undefined;
}

export function ThemeSwitcher({
  themes,
  activeId,
  input,
  onApply,
  onCancel,
}: {
  themes: readonly ThemeSwitcherOption[];
  activeId: string;
  input: InputSettings;
  onApply: (id: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      themes.findIndex((theme) => theme.id === activeId),
    ),
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
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

  const n = themes.length;
  useInputActions({
    targetRef: ref,
    enabled: true,
    input,
    onAction: (action) => {
      if (action === 'left' || action === 'up') setIndex((i) => (i - 1 + n) % n);
      else if (action === 'right' || action === 'down') setIndex((i) => (i + 1) % n);
      else if (action === 'select') {
        const theme = themes[index];
        if (theme) onApply(theme.id);
      } else if (action === 'back' || action === 'menu' || action === 'switchTheme') onCancel();
    },
  });

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-label={t('themes.switcher.label')}
      className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 outline-none backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="flex flex-wrap justify-center gap-4 p-6"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        {themes.map((theme, i) => (
          <button
            key={theme.id}
            type="button"
            tabIndex={-1}
            aria-pressed={i === index}
            onClick={() => {
              onApply(theme.id);
            }}
            onMouseEnter={() => {
              setIndex(i);
            }}
            className={cn(
              'w-56 rounded-2xl border p-5 text-left text-white transition',
              i === index ? 'scale-105 border-white bg-white/20' : 'border-white/10 bg-white/5',
            )}
          >
            <div className="text-lg font-semibold">{t(theme.nameKey)}</div>
            {theme.descriptionKey && (
              <div className="mt-1 text-xs text-white/60">{t(theme.descriptionKey)}</div>
            )}
            {theme.id === activeId && (
              <div className="mt-2 text-[10px] tracking-wider text-white/50 uppercase">
                {t('themes.switcher.current')}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
