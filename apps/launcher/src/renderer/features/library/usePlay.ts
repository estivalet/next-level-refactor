import type { AppError } from '@nextlevel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useContext, useState } from 'react';
import { getBridge } from '../../bridge.ts';
import { useIpcEvent } from '../../events.ts';
import { FrontendContext } from '../frontend/useFrontend.ts';
import { launchAppError } from '../launch/LaunchErrorDetails.tsx';
import { unwrap } from '../settings/settingsApi.ts';
import { GAME_KEY } from './libraryApi.ts';

const RUNNING_KEY = ['launch.running'] as const;

/** A Play that failed: before the emulator started, or by exiting with an error (D5). */
export interface PlayFailure {
  gameId: number;
  error: AppError | null;
}

/**
 * Play from the Library (FR-EMU-6, US-C2): one game at a time (D4). The running game comes from
 * `launch.running` on mount and the `launch.started/finished` events after that.
 */
export function usePlay({ onFinished }: { onFinished: () => void }) {
  const client = useQueryClient();
  const [failure, setFailure] = useState<PlayFailure | null>(null);
  // A run that ends while the front-end shows started there, and the front-end reports it.
  const frontendVisible = useContext(FrontendContext)?.visible ?? false;
  const running = useQuery({
    queryKey: RUNNING_KEY,
    queryFn: async () => unwrap(await getBridge().invoke('launch.running')),
  });
  useIpcEvent('launch.started', (started) => {
    client.setQueryData(RUNNING_KEY, started);
  });
  useIpcEvent('launch.finished', (finished) => {
    client.setQueryData(RUNNING_KEY, null);
    // The play count and last played changed (D5: only counted runs).
    if (finished.counted) void client.invalidateQueries({ queryKey: [GAME_KEY, finished.gameId] });
    if (finished.error && !frontendVisible) {
      setFailure({ gameId: finished.gameId, error: finished.error });
    }
    onFinished();
  });
  const launch = useMutation({
    mutationFn: async (gameId: number) =>
      unwrap(await getBridge().invoke('launch.game', { gameId })),
    onError: (error, gameId) => {
      setFailure({ gameId, error: launchAppError(error) });
    },
  });
  const busy = launch.isPending || Boolean(running.data);
  return {
    runningGameId: running.data?.gameId ?? null,
    busy,
    play: (gameId: number) => {
      if (!busy) launch.mutate(gameId);
    },
    failure,
    dismiss: () => {
      setFailure(null);
    },
  };
}

export type Play = ReturnType<typeof usePlay>;
