import type { IpcEvent, IpcEventPayload } from '@nextlevel/shared';
import { useEffect, useRef } from 'react';
import { getBridge } from './bridge.ts';

/** Subscribes to a main → renderer event while the component is mounted. */
export function useIpcEvent<E extends IpcEvent>(
  event: E,
  listener: (payload: IpcEventPayload<E>) => void,
): void {
  // The latest listener is called without resubscribing on every render.
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  });
  useEffect(
    () =>
      getBridge().on(event, (payload) => {
        latest.current(payload);
      }),
    [event],
  );
}
