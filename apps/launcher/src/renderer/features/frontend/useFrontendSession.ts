import type { AppError } from '@nextlevel/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { getBridge } from '../../bridge.ts';
import { useIpcEvent } from '../../events.ts';
import { unwrap } from '../settings/settingsApi.ts';

const RUNNING_KEY = ['launch.running'] as const;

/** A launch from the front-end that failed, before or after the emulator started (US-C2). */
export interface FrontendFailure {
  gameId: number;
  error: AppError | null;
}

/**
 * What the front-end tracks around Play: the running game (theme input pauses meanwhile) and a
 * failure to show. Failures of runs that end while the front-end is hidden belong to whoever
 * started them (the Library), so they are left alone.
 */
export function useFrontendSession(visible: boolean) {
  const client = useQueryClient();
  const [failure, setFailure] = useState<FrontendFailure | null>(null);
  // Asked to launch, not started yet (resolving, extracting, spawning): input waits meanwhile.
  const [pendingGameId, setPendingGameId] = useState<number | null>(null);
  const running = useQuery({
    queryKey: RUNNING_KEY,
    queryFn: async () => unwrap(await getBridge().invoke('launch.running')),
  });
  useIpcEvent('launch.started', (started) => {
    client.setQueryData(RUNNING_KEY, started);
    setPendingGameId(null);
  });
  useIpcEvent('launch.finished', (finished) => {
    client.setQueryData(RUNNING_KEY, null);
    setPendingGameId(null);
    if (finished.error && visible) setFailure({ gameId: finished.gameId, error: finished.error });
  });
  const report = useCallback((gameId: number, error: AppError) => {
    setPendingGameId(null);
    setFailure({ gameId, error });
  }, []);
  const launching = useCallback((gameId: number) => {
    setPendingGameId(gameId);
  }, []);
  const dismiss = useCallback(() => {
    setFailure(null);
  }, []);
  const runningGameId = running.data?.gameId ?? null;
  return {
    /** The game being started or running; null when none. */
    playingGameId: runningGameId ?? pendingGameId,
    failure,
    report,
    launching,
    dismiss,
  };
}
