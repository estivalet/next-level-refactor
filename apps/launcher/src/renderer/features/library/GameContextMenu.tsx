import type { GameFlags, GameRow } from '@nextlevel/shared';
import {
  Eye,
  EyeOff,
  FolderOpen,
  Link2,
  Pencil,
  Play,
  SlidersHorizontal,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useRevealGame, useSetFlags } from './libraryApi.ts';

export interface MenuItem {
  key: string;
  label: string;
  icon: LucideIcon;
  run: () => void;
}

interface GameContextMenuProps {
  /** Every selected game id: the menu acts on all of them. */
  gameIds: readonly number[];
  /** The selected rows that are loaded, for labels and single-game items. */
  games: readonly GameRow[];
  point: { x: number; y: number };
  onClose: () => void;
  onEdit: (gameId: number) => void;
  /** Play the game (US-C2); offered for one present game when nothing is starting or running. */
  onPlay?: (gameId: number) => void;
  onLaunchOptions: (gameId: number) => void;
  onMissingReason: (gameId: number) => void;
  /** Told about flag changes, so the list can move the selection when games leave it. */
  onFlags: (flags: GameFlags) => void;
  /** Items added by the caller, e.g. collections (Task 11). */
  extraItems?: readonly MenuItem[];
}

/**
 * The game context menu (S7). Portaled to document.body: the shell window's backdrop-filter makes
 * it the containing block for `position: fixed`, which would clip the menu to the window.
 */
export function GameContextMenu(props: GameContextMenuProps) {
  const { t } = useTranslation();
  const setFlags = useSetFlags();
  const reveal = useRevealGame();
  const menu = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState(props.point);
  const { games, onClose } = props;
  const ids = [...props.gameIds];
  const single = ids.length === 1 ? games.find((game) => game.id === ids[0]) : undefined;
  // Rows not loaded are unknown: treat the selection as mixed, so the action sets the flag.
  const allKnown = games.length === ids.length;
  const allFavorite = allKnown && games.every((game) => game.favorite);
  const allHidden = allKnown && games.every((game) => game.hidden);

  const flag = (flags: GameFlags) => {
    setFlags.mutate({ gameIds: ids, flags });
    props.onFlags(flags);
  };
  const items: MenuItem[] = [];
  const { onPlay } = props;
  if (single && !single.missing && onPlay) {
    items.push({
      key: 'play',
      label: t('library.menu.play'),
      icon: Play,
      run: () => {
        onPlay(single.id);
      },
    });
  }
  if (single) {
    items.push({
      key: 'edit',
      label: t('library.menu.edit'),
      icon: Pencil,
      run: () => {
        props.onEdit(single.id);
      },
    });
  }
  items.push(
    {
      key: 'favorite',
      label: t(allFavorite ? 'library.menu.unfavorite' : 'library.menu.favorite'),
      icon: Star,
      run: () => {
        flag({ favorite: !allFavorite });
      },
    },
    {
      key: 'hide',
      label: t(allHidden ? 'library.menu.unhide' : 'library.menu.hide'),
      icon: allHidden ? Eye : EyeOff,
      run: () => {
        flag({ hidden: !allHidden });
      },
    },
    ...(props.extraItems ?? []),
  );
  if (single) {
    items.push({
      key: 'launchOptions',
      label: t('library.menu.launchOptions'),
      icon: SlidersHorizontal,
      run: () => {
        props.onLaunchOptions(single.id);
      },
    });
    items.push({
      key: 'reveal',
      label: t('library.menu.openFolder'),
      icon: FolderOpen,
      run: () => {
        reveal.mutate(single.id);
      },
    });
    if (single.missing) {
      items.push({
        key: 'missing',
        label: t('library.menu.missingReason'),
        icon: Link2,
        run: () => {
          props.onMissingReason(single.id);
        },
      });
    }
  }

  // Keep the menu inside the viewport.
  useLayoutEffect(() => {
    const box = menu.current?.getBoundingClientRect();
    if (!box) return;
    setPosition({
      x: Math.max(0, Math.min(props.point.x, window.innerWidth - box.width)),
      y: Math.max(0, Math.min(props.point.y, window.innerHeight - box.height)),
    });
  }, [props.point]);
  useEffect(() => {
    menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')[active]?.focus();
  }, [active]);
  useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener('mousedown', outside);
    return () => {
      document.removeEventListener('mousedown', outside);
    };
  }, [onClose]);

  const onKeyDown = (event: KeyboardEvent) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (step !== undefined) setActive((active + step + items.length) % items.length);
    else if (event.key === 'Home') setActive(0);
    else if (event.key === 'End') setActive(items.length - 1);
    else if (event.key === 'Escape' || event.key === 'Tab') onClose();
    else return;
    event.preventDefault();
  };

  return createPortal(
    <div
      ref={menu}
      role="menu"
      aria-label={t('library.menu.label')}
      onKeyDown={onKeyDown}
      className="fixed z-50 min-w-48 rounded-lg border border-white/10 bg-[#1a1a24] py-1 text-sm text-slate-300 shadow-2xl"
      style={{ left: position.x, top: position.y }}
    >
      {items.map((item, index) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          tabIndex={index === active ? 0 : -1}
          onClick={() => {
            item.run();
            onClose();
          }}
          className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white focus:outline-none"
        >
          <item.icon aria-hidden="true" className="h-3.5 w-3.5" />
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
