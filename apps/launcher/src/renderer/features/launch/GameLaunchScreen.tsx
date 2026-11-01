import { mediaUrl } from '@nextlevel/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getBridge } from '../../bridge.ts';
import { useIpcEvent } from '../../events.ts';
import { useGameDetails } from '../library/libraryApi.ts';
import { unwrap } from '../settings/settingsApi.ts';

const RUNNING_KEY = ['launch.running'] as const;

/**
 * The launch screen (FR-EMU-6): covers the whole launcher, desktop and front-end alike, while a
 * game runs. The launcher window stays up behind the emulator, so this is what shows until the
 * emulator's window appears, instead of the Windows desktop. Deliberately plain for now.
 */
export function GameLaunchScreen() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const running = useQuery({
    queryKey: RUNNING_KEY,
    queryFn: async () => unwrap(await getBridge().invoke('launch.running')),
  });
  // Set here too: the Library and the front-end may not be open to follow the events.
  useIpcEvent('launch.started', (started) => {
    client.setQueryData(RUNNING_KEY, started);
  });
  useIpcEvent('launch.finished', () => {
    client.setQueryData(RUNNING_KEY, null);
  });
  const gameId = running.data?.gameId ?? null;
  const game = useGameDetails(gameId).data;
  const [brokenArt, setBrokenArt] = useState<string | null>(null);
  if (gameId === null) return null;

  const boxVersion = game?.media['box-front'];
  const art = game && boxVersion !== undefined ? mediaUrl(game.id, 'box-front', boxVersion) : null;
  return (
    <div
      role="status"
      aria-label={t('launchScreen.label')}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-8 bg-[#05070c] text-white select-none"
    >
      {art && brokenArt !== art && (
        <img
          src={art}
          alt=""
          className="max-h-[45vh] max-w-[60vw] rounded-lg object-contain shadow-2xl"
          onError={() => {
            setBrokenArt(art);
          }}
        />
      )}
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-xs tracking-widest text-sky-400 uppercase">
          {t('launchScreen.nowPlaying')}
        </p>
        {game && <h1 className="max-w-[80vw] text-4xl font-black tracking-tight">{game.title}</h1>}
      </div>
      <div
        aria-hidden
        className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-sky-400"
      />
      <p className="text-sm text-white/50">{t('launchScreen.hint')}</p>
    </div>
  );
}
