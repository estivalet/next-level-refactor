import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SECONDARY_BUTTON } from '../../library/Modal.tsx';
import { TokenInput } from './TokenInput.tsx';

const ICON_BUTTON =
  'rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none';

/** A profile's argv templates, one row per element (FR-EMU-2/3): edit, add, remove, reorder. */
export function ArgsEditor({
  args,
  onChange,
}: {
  args: readonly string[];
  onChange: (args: string[]) => void;
}) {
  const { t } = useTranslation();
  const set = (index: number, value: string) => {
    onChange(args.map((arg, i) => (i === index ? value : arg)));
  };
  const move = (index: number, by: -1 | 1) => {
    const next = [...args];
    const [moved] = next.splice(index, 1);
    if (moved === undefined) return;
    next.splice(index + by, 0, moved);
    onChange(next);
  };

  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-[11px] text-slate-400">
        {t('settings.emulators.editor.args')}
      </legend>
      <p className="mb-1 text-[11px] text-slate-500">{t('settings.emulators.editor.argsHelp')}</p>
      {args.map((arg, index) => {
        const n = index + 1;
        return (
          // Rows have no stable identity; the index is what the user reorders.
          <div key={index} className="flex items-start gap-1">
            <TokenInput
              value={arg}
              where="arg"
              label={t('settings.emulators.editor.arg', { n })}
              onChange={(value) => {
                set(index, value);
              }}
            />
            <button
              type="button"
              aria-label={t('settings.emulators.editor.moveUp', { n })}
              disabled={index === 0}
              className={ICON_BUTTON}
              onClick={() => {
                move(index, -1);
              }}
            >
              <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label={t('settings.emulators.editor.moveDown', { n })}
              disabled={index === args.length - 1}
              className={ICON_BUTTON}
              onClick={() => {
                move(index, 1);
              }}
            >
              <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label={t('settings.emulators.editor.removeArg', { n })}
              className={ICON_BUTTON}
              onClick={() => {
                onChange(args.filter((_, i) => i !== index));
              }}
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className={`${SECONDARY_BUTTON} w-fit`}
        onClick={() => {
          onChange([...args, '']);
        }}
      >
        {t('settings.emulators.editor.addArg')}
      </button>
    </fieldset>
  );
}
