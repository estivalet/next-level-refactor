import type { GameRow } from '@nextlevel/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalSearch } from '../../library/libraryApi.ts';
import { INPUT, SECONDARY_BUTTON } from '../../library/Modal.tsx';

/** Picks the game a preview and Test launch use (FR-EMU-5), searching the whole library. */
export function GamePicker({
  game,
  onChange,
}: {
  game: GameRow | null;
  onChange: (game: GameRow | null) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const search = useGlobalSearch(text);

  if (game) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-200">
        <span className="min-w-0 truncate">
          {game.title} · {game.systemId}
        </span>
        <button
          type="button"
          className={SECONDARY_BUTTON}
          onClick={() => {
            onChange(null);
          }}
        >
          {t('settings.emulators.editor.clearGame')}
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <input
        type="search"
        value={text}
        aria-label={t('settings.emulators.editor.gameSearch')}
        placeholder={t('settings.emulators.editor.gameSearch')}
        onChange={(event) => {
          setText(event.target.value);
        }}
        className={INPUT}
      />
      {search.active && (
        <ul className="max-h-40 overflow-y-auto rounded-lg border border-white/10">
          {(search.data?.games ?? []).slice(0, 50).map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(row);
                  setText('');
                }}
                className="w-full px-3 py-1 text-left text-xs text-slate-200 hover:bg-white/10"
              >
                {row.title} · {row.systemId}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
