import type { EntryRule } from '@nextlevel/shared';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SECONDARY_BUTTON } from '../../library/Modal.tsx';
import { TokenInput } from './TokenInput.tsx';

const ICON_BUTTON =
  'rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none';

/** A rule's arguments as typed: words separated by spaces (one word = one argv element). */
const words = (text: string) => text.split(/\s+/).filter(Boolean);

/**
 * A profile's game file rules (FR-EMU-9): per row, the file to look for and the arguments it
 * gives `{entryArgs}`; add, remove and reorder, since the first existing file wins.
 */
export function EntryRulesEditor({
  entries,
  onChange,
}: {
  entries: readonly EntryRule[];
  onChange: (entries: EntryRule[]) => void;
}) {
  const { t } = useTranslation();
  // The arguments text as typed, so a trailing space survives until the next word.
  const [texts, setTexts] = useState(() => entries.map((rule) => rule.args.join(' ')));
  const change = (next: EntryRule[], nextTexts: string[]) => {
    setTexts(nextTexts);
    onChange(next);
  };
  const move = (index: number, by: -1 | 1) => {
    const swap = <T,>(list: readonly T[]) => {
      const copy = [...list];
      const [moved] = copy.splice(index, 1);
      if (moved !== undefined) copy.splice(index + by, 0, moved);
      return copy;
    };
    change(swap(entries), swap(texts));
  };

  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-[11px] text-slate-400">
        {t('settings.emulators.editor.entries')}
      </legend>
      <p className="mb-1 text-[11px] text-slate-500">
        {t('settings.emulators.editor.entriesHelp')}
      </p>
      {entries.map((rule, index) => {
        const n = index + 1;
        return (
          // Rows have no stable identity; the index is what the user reorders.
          <div key={index} className="flex items-start gap-1">
            <TokenInput
              value={rule.file}
              where="value"
              label={t('settings.emulators.editor.entryFile', { n })}
              placeholder="{gameDir}\{romName}.singe"
              onChange={(file) => {
                change(
                  entries.map((r, i) => (i === index ? { ...r, file } : r)),
                  texts,
                );
              }}
            />
            <TokenInput
              value={texts[index] ?? rule.args.join(' ')}
              where="entry"
              label={t('settings.emulators.editor.entryArgs', { n })}
              placeholder="-script {entry}"
              onChange={(text) => {
                change(
                  entries.map((r, i) => (i === index ? { ...r, args: words(text) } : r)),
                  texts.map((x, i) => (i === index ? text : x)),
                );
              }}
            />
            <button
              type="button"
              aria-label={t('settings.emulators.editor.moveEntryUp', { n })}
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
              aria-label={t('settings.emulators.editor.moveEntryDown', { n })}
              disabled={index === entries.length - 1}
              className={ICON_BUTTON}
              onClick={() => {
                move(index, 1);
              }}
            >
              <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label={t('settings.emulators.editor.removeEntry', { n })}
              className={ICON_BUTTON}
              onClick={() => {
                change(
                  entries.filter((_, i) => i !== index),
                  texts.filter((_, i) => i !== index),
                );
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
          change([...entries, { file: '', args: [] }], [...texts, '']);
        }}
      >
        {t('settings.emulators.editor.addEntry')}
      </button>
    </fieldset>
  );
}
