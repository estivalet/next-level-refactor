import { mediaUrl, type GameRow as Game } from '@nextlevel/shared';
import { Gamepad2, Star } from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

interface GameCardProps {
  game: Game;
  index: number;
  selected: boolean;
  focused: boolean;
  style: { left: number; top: number; width: number; height: number };
  onClick: (event: MouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (event: MouseEvent) => void;
}

/**
 * One game in the grid (D62): its box art, or a placeholder of the same size when there is none
 * or it fails to load; missing games are greyed and name their expected path (FR-LIB-4).
 */
export function GameCard({
  game,
  index,
  selected,
  focused,
  style,
  onClick,
  onDoubleClick,
  onContextMenu,
}: GameCardProps) {
  const { t } = useTranslation();
  const src = game.boxArt === null ? null : mediaUrl(game.id, 'box-front', game.boxArt);
  const [broken, setBroken] = useState<string | null>(null);
  return (
    <div
      id={`library-game-${String(index)}`}
      role="option"
      aria-selected={selected}
      title={game.expectedPath ? t('library.missingAt', { path: game.expectedPath }) : undefined}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={`absolute flex cursor-default flex-col overflow-hidden rounded-xl border select-none ${
        selected ? 'border-emerald-400 ring-2 ring-emerald-400/40' : 'border-white/5'
      } ${focused ? 'outline outline-1 outline-white/40' : ''} ${
        game.missing ? 'opacity-40 grayscale' : ''
      }`}
      style={style}
    >
      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950">
        {src && broken !== src ? (
          <img
            src={src}
            alt={game.title}
            loading="lazy"
            draggable={false}
            className="h-full w-full object-cover"
            onError={() => {
              setBroken(src);
            }}
          />
        ) : (
          <Gamepad2 aria-hidden="true" className="h-10 w-10 text-white/10" />
        )}
        {game.favorite && (
          <Star
            aria-hidden="true"
            className="absolute top-2 right-2 h-3.5 w-3.5 fill-amber-400 text-amber-400"
          />
        )}
      </div>
      <span
        className={`shrink-0 truncate bg-black/60 px-2 py-1.5 text-xs ${
          selected ? 'text-emerald-300' : 'text-slate-200'
        }`}
      >
        {game.title}
      </span>
    </div>
  );
}
