import type { GameRow as Game } from '@nextlevel/shared';
import { Gamepad2, Star } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

interface GameRowProps {
  game: Game;
  index: number;
  selected: boolean;
  focused: boolean;
  top: number;
  height: number;
  onClick: (event: MouseEvent) => void;
  onContextMenu: (event: MouseEvent) => void;
}

/** One game line; missing games are greyed and name their expected path (FR-LIB-4). */
export function GameRow({
  game,
  index,
  selected,
  focused,
  top,
  height,
  onClick,
  onContextMenu,
}: GameRowProps) {
  const { t } = useTranslation();
  return (
    <div
      id={`library-game-${String(index)}`}
      role="option"
      aria-selected={selected}
      title={game.expectedPath ? t('library.missingAt', { path: game.expectedPath }) : undefined}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`absolute left-0 flex w-full cursor-default items-center gap-4 rounded-lg border px-4 text-left select-none ${
        selected ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-transparent hover:bg-white/5'
      } ${focused ? 'ring-1 ring-white/30' : ''} ${game.missing ? 'opacity-40 grayscale' : ''}`}
      style={{ top, height: height - 4 }}
    >
      <Gamepad2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-600" />
      <span
        className={`flex-1 truncate text-sm ${selected ? 'text-emerald-300' : 'text-slate-300'}`}
      >
        {game.title}
      </span>
      {game.year !== null && (
        <span className="shrink-0 font-mono text-xs text-slate-600">{game.year}</span>
      )}
      {game.genre && (
        <span className="max-w-32 shrink-0 truncate text-xs text-slate-600">{game.genre}</span>
      )}
      {game.favorite && (
        <Star
          aria-label={t('library.tabs.favorites')}
          className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400"
        />
      )}
    </div>
  );
}
