import type { EmitEvent } from '../ipc/events.ts';

/** Events after which what the menu can show may have moved. */
const WATCHED = new Set(['library.changed', 'settings.changed']);

/**
 * Wraps the event sink so `menus.changed` also goes out when a game or settings change alters
 * what the menu can show (a smart filter or collection gains or loses its last game, a system is
 * enabled, a collection appears in the generated menu). Compares a fingerprint of that
 * (`menuFingerprint`) with the one taken at the last `menus.changed`.
 */
export function createMenuWatch(
  inner: EmitEvent,
  log: { warn(context: object, msg: string): void },
) {
  let fingerprint: (() => string) | null = null;
  let last: string | null = null;
  const take = (): string | null => {
    if (!fingerprint) return null;
    try {
      return fingerprint();
    } catch (error) {
      log.warn({ error }, 'could not check whether the menu changed');
      return null;
    }
  };
  const emit: EmitEvent = (event, payload) => {
    inner(event, payload);
    if (event === 'menus.changed') {
      last = take();
      return;
    }
    if (!WATCHED.has(event)) return;
    const now = take();
    if (now === null || now === last) return;
    last = now;
    inner('menus.changed', {});
  };
  return {
    emit,
    /** Starts watching (once the library is open), taking the baseline now. */
    watch(next: () => string) {
      fingerprint = next;
      last = take();
    },
  };
}
