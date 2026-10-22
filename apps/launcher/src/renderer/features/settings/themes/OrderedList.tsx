import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const BUTTON =
  'rounded p-1 text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none';

/**
 * An ordered choice (background folders, game background sources, game art kinds): move up,
 * move down, remove, and add one of `options` not in the list yet.
 */
export function OrderedList({
  label,
  items,
  options,
  itemLabel = (value) => value,
  onChange,
}: {
  label: string;
  items: readonly string[];
  options: readonly string[];
  itemLabel?: (value: string) => string;
  onChange: (items: string[]) => void;
}) {
  const { t } = useTranslation();
  const addable = options.filter((option) => !items.includes(option));
  const [picked, setPicked] = useState('');
  const toAdd = addable.includes(picked) ? picked : (addable[0] ?? '');
  const move = (from: number, to: number) => {
    const next = [...items];
    const [item] = next.splice(from, 1);
    if (item !== undefined) next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="flex w-72 flex-col gap-1">
      <ul aria-label={label} className="flex flex-col gap-1">
        {items.map((item, i) => {
          const name = itemLabel(item);
          return (
            <li
              key={item}
              data-value={item}
              className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-xs text-white"
            >
              <span className="min-w-0 flex-1 truncate">{name}</span>
              <button
                type="button"
                aria-label={t('settings.themes.options.moveUp', { item: name })}
                disabled={i === 0}
                onClick={() => {
                  move(i, i - 1);
                }}
                className={BUTTON}
              >
                <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label={t('settings.themes.options.moveDown', { item: name })}
                disabled={i === items.length - 1}
                onClick={() => {
                  move(i, i + 1);
                }}
                className={BUTTON}
              >
                <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label={t('settings.themes.options.remove', { item: name })}
                onClick={() => {
                  onChange(items.filter((value) => value !== item));
                }}
                className={BUTTON}
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
      {addable.length > 0 && (
        <div className="flex gap-2">
          <select
            aria-label={t('settings.themes.options.addTo', { label })}
            value={toAdd}
            onChange={(event) => {
              setPicked(event.target.value);
            }}
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
          >
            {addable.map((option) => (
              <option key={option} value={option}>
                {itemLabel(option)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              if (toAdd) onChange([...items, toAdd]);
            }}
            className="rounded-md bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
          >
            {t('settings.themes.options.add')}
          </button>
        </div>
      )}
    </div>
  );
}
