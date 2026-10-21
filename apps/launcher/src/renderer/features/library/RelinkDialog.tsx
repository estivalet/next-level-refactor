import type { GameDetails, GameRow } from '@nextlevel/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { keyStep } from './selection.ts';
import { getBridge } from '../../bridge.ts';
import { unwrap } from '../settings/settingsApi.ts';
import { useGameDetails, useRelink } from './libraryApi.ts';
import { INPUT, Modal, PRIMARY_BUTTON, SECONDARY_BUTTON } from './Modal.tsx';
import { GAMES_KEY } from './usePagedGames.ts';

const CANDIDATES = 50;

/**
 * Relink (FR-LIB-3, owner decision 2026-10-21): a missing game takes the file of a game found in
 * the same system, keeping its own details, favorite and collections.
 */
export function RelinkDialog({ gameId, onClose }: { gameId: number; onClose: () => void }) {
  const details = useGameDetails(gameId);
  return details.data ? <RelinkForm game={details.data} onClose={onClose} /> : null;
}

function RelinkForm({ game, onClose }: { game: GameDetails; onClose: () => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [chosen, setChosen] = useState<GameRow | null>(null);
  const relink = useRelink();
  const params = {
    scope: { kind: 'system' as const, systemId: game.systemId },
    tab: 'all' as const,
    text,
    offset: 0,
    limit: CANDIDATES,
  };
  const candidates = useQuery({
    queryKey: [GAMES_KEY, 'relink', params],
    queryFn: async () => unwrap(await getBridge().invoke('library.games.list', params)),
  });
  const present = (candidates.data?.games ?? []).filter((row) => !row.missing);

  return (
    <Modal
      title={t('library.relink.title', { title: game.title })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
            {t('library.relink.cancel')}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={!chosen || relink.isPending}
            onClick={() => {
              if (!chosen) return;
              relink.mutate(
                { missingGameId: game.id, replacementGameId: chosen.id },
                { onSuccess: onClose },
              );
            }}
          >
            {t('library.relink.confirm')}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-xs">
        <p className="text-slate-300">{t('library.relink.intro', { title: game.title })}</p>
        <p className="break-all text-slate-500">{game.expectedPath ?? game.relPath}</p>
        <input
          type="search"
          aria-label={t('library.relink.search')}
          placeholder={t('library.relink.search')}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
          className={INPUT}
        />
        {present.length === 0 ? (
          <p className="text-slate-500">{t('library.relink.none')}</p>
        ) : (
          <ul
            role="listbox"
            tabIndex={0}
            aria-label={t('library.relink.candidates')}
            aria-activedescendant={chosen ? `relink-${String(chosen.id)}` : undefined}
            onKeyDown={(event) => {
              const at = present.findIndex((row) => row.id === chosen?.id);
              const next = keyStep(event.key, at, present.length);
              if (next === null) return;
              event.preventDefault();
              setChosen(present[next] ?? null);
            }}
            className="max-h-56 overflow-y-auto rounded-lg border border-white/5"
          >
            {present.map((row) => (
              <li
                key={row.id}
                id={`relink-${String(row.id)}`}
                role="option"
                aria-selected={chosen?.id === row.id}
                onClick={() => {
                  setChosen(row);
                }}
                className="cursor-default px-3 py-1.5 text-slate-300 hover:bg-white/5 aria-selected:bg-emerald-500/10 aria-selected:text-emerald-300"
              >
                {row.title}
              </li>
            ))}
          </ul>
        )}
        {chosen && (
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-amber-200">
            {t('library.relink.warning', { title: game.title, replacement: chosen.title })}
          </p>
        )}
      </div>
    </Modal>
  );
}
