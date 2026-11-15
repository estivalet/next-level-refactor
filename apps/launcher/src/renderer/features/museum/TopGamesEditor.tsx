import type { SystemInfoTopGame } from '@nextlevel/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SECONDARY_BUTTON } from '../library/Modal.tsx';
import type { FieldErrors } from './formErrors.ts';
import { TextField, YearField } from './FormFields.tsx';
import { GamePicker } from './GamePicker.tsx';
import { ListEditor } from './ListEditor.tsx';

/** The curated top games; a row can be pinned to a library game (FR-MUS-3). */
export function TopGamesEditor({
  systemId,
  games,
  errors,
  onChange,
}: {
  systemId: string;
  games: readonly SystemInfoTopGame[];
  errors: FieldErrors;
  onChange: (games: SystemInfoTopGame[]) => void;
}) {
  const { t } = useTranslation();
  const [linking, setLinking] = useState<number | null>(null);
  const setGameId = (index: number, gameId: number | undefined) => {
    onChange(
      games.map((game, position) => {
        if (position !== index) return game;
        return gameId === undefined
          ? { title: game.title, year: game.year }
          : { title: game.title, year: game.year, gameId };
      }),
    );
  };
  return (
    <>
      <ListEditor<SystemInfoTopGame>
        items={games}
        onChange={onChange}
        makeNew={() => ({ title: '' })}
        addLabel={t('apps.museum.addTopGame')}
        listLabel={t('apps.museum.sections.topGames')}
        renderRow={(game, index, update) => (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[1fr_8rem] gap-2">
              <TextField
                label={t('apps.museum.field.title')}
                value={game.title}
                error={errors[`topGames.${String(index)}.title`]}
                onChange={(title) => {
                  update({ ...game, title: title ?? '' });
                }}
              />
              <YearField
                label={t('apps.museum.field.year')}
                value={game.year}
                error={errors[`topGames.${String(index)}.year`]}
                onChange={(year) => {
                  update({ ...game, year });
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              {game.gameId !== undefined && (
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-300">
                  {t('apps.museum.inLibrary')}
                </span>
              )}
              <button
                type="button"
                className={SECONDARY_BUTTON}
                onClick={() => {
                  setLinking(index);
                }}
              >
                {t('apps.museum.link')}
              </button>
              {game.gameId !== undefined && (
                <button
                  type="button"
                  className={SECONDARY_BUTTON}
                  onClick={() => {
                    setGameId(index, undefined);
                  }}
                >
                  {t('apps.museum.unlink')}
                </button>
              )}
            </div>
          </div>
        )}
      />
      {linking !== null && (
        <GamePicker
          systemId={systemId}
          onPick={(gameId) => {
            setGameId(linking, gameId);
            setLinking(null);
          }}
          onClose={() => {
            setLinking(null);
          }}
        />
      )}
    </>
  );
}
