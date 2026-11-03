import { PLAYABILITY_MARKS, type PlayabilityMark } from '@nextlevel/shared';
import { CircleAlert, CircleCheck, CircleX, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const MARK_ICONS: Record<PlayabilityMark, LucideIcon> = {
  works: CircleCheck,
  issues: CircleAlert,
  broken: CircleX,
};

const PRESSED: Record<PlayabilityMark, string> = {
  works: 'bg-emerald-500/15 text-emerald-300',
  issues: 'bg-amber-500/15 text-amber-300',
  broken: 'bg-red-500/15 text-red-300',
};

/**
 * Works / Minor issues / Broken as toggle buttons (FR-LIB-13). Pressing the chosen mark again
 * clears it (`onChange(null)`).
 */
export function PlayabilityPicker(props: {
  value: PlayabilityMark | null;
  onChange: (mark: PlayabilityMark | null) => void;
  disabled?: boolean;
}) {
  const { value, onChange } = props;
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t('library.playability.label')} className="flex flex-wrap gap-1">
      {PLAYABILITY_MARKS.map((mark) => {
        const Icon = MARK_ICONS[mark];
        const pressed = value === mark;
        return (
          <button
            key={mark}
            type="button"
            aria-pressed={pressed}
            disabled={props.disabled}
            onClick={() => {
              onChange(pressed ? null : mark);
            }}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] disabled:opacity-50 ${
              pressed
                ? PRESSED[mark]
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5" />
            {t(`library.playability.${mark}`)}
          </button>
        );
      })}
    </div>
  );
}
