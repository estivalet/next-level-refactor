import type { GameFlags } from '@nextlevel/shared';
import { FolderOpen, Gamepad2, Link2, Pencil, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useGameDetails, useRevealGame, useSetFlags } from './libraryApi.ts';
import { RatingStars } from './RatingStars.tsx';

const ACTION =
  'flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/10 hover:text-white aria-pressed:text-amber-300';

interface GameDetailsProps {
  gameId: number | null;
  systemName: (systemId: string) => string;
  onEdit: (gameId: number) => void;
  onRelink: (gameId: number) => void;
  /** Told about flag changes, so the list can move the selection when a game leaves it. */
  onFlags: (flags: GameFlags) => void;
}

/** The right panel (S7): one game's metadata, favorite, rating and actions. */
export function GameDetails({ gameId, systemName, onEdit, onRelink, onFlags }: GameDetailsProps) {
  const { t, i18n } = useTranslation();
  const details = useGameDetails(gameId);
  const setFlags = useSetFlags();
  const reveal = useRevealGame();
  const game = details.data;
  if (gameId === null || !game) {
    return <p className="p-4 text-xs text-slate-500">{t('library.details.none')}</p>;
  }
  const facts = [
    ['year', game.year],
    ['developer', game.developer],
    ['publisher', game.publisher],
    ['genre', game.genre],
    ['players', game.players],
    ['region', game.region],
  ] as const;
  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-4">
      <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-gradient-to-br from-emerald-900/30 to-slate-900">
        <Gamepad2 aria-hidden="true" className="h-12 w-12 text-emerald-400/20" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-white">{game.title}</h3>
        <p className="text-xs text-slate-500">{systemName(game.systemId)}</p>
      </div>
      {game.missing && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
          <p>
            {t('library.details.missingSince', {
              date: new Date(game.missingSince ?? game.addedAt).toLocaleDateString(i18n.language),
            })}
          </p>
          <p className="mt-1 break-all text-amber-200/70">
            {t('library.details.expectedAt', { path: game.expectedPath ?? game.relPath })}
          </p>
          <button
            type="button"
            className={`${ACTION} mt-2`}
            onClick={() => {
              onRelink(game.id);
            }}
          >
            <Link2 aria-hidden="true" className="h-3.5 w-3.5" />
            {t('library.details.relink')}
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={game.favorite}
          className={ACTION}
          onClick={() => {
            const flags = { favorite: !game.favorite };
            setFlags.mutate({ gameIds: [game.id], flags });
            onFlags(flags);
          }}
        >
          <Star
            aria-hidden="true"
            className={`h-3.5 w-3.5 ${game.favorite ? 'fill-amber-400 text-amber-400' : ''}`}
          />
          {t('library.details.favorite')}
        </button>
        <RatingStars
          value={game.userRating}
          onChange={(userRating) => {
            setFlags.mutate({ gameIds: [game.id], flags: { userRating } });
          }}
        />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {facts.map(([field, value]) =>
          value === null ? null : (
            <div key={field} className="contents">
              <dt className="text-slate-500">{t(`library.fields.${field}`)}</dt>
              <dd className="truncate text-right text-slate-300">{value}</dd>
            </div>
          ),
        )}
      </dl>
      {game.filters.length > 0 && (
        <ul aria-label={t('library.fields.filters')} className="flex flex-wrap gap-1">
          {game.filters.map((filter) => (
            <li
              key={filter}
              className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-slate-400"
            >
              {filter}
            </li>
          ))}
        </ul>
      )}
      {game.description && (
        <p className="text-xs leading-relaxed whitespace-pre-line text-slate-400">
          {game.description}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={ACTION}
          onClick={() => {
            onEdit(game.id);
          }}
        >
          <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
          {t('library.details.edit')}
        </button>
        <button
          type="button"
          className={ACTION}
          onClick={() => {
            reveal.mutate(game.id);
          }}
        >
          <FolderOpen aria-hidden="true" className="h-3.5 w-3.5" />
          {t('library.details.openFolder')}
        </button>
      </div>
    </div>
  );
}
