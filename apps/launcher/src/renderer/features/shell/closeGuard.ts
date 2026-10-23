import { createContext, useContext, useEffect, useRef } from 'react';

export interface WindowClose {
  /** The guard the close button asks first; it returns false to keep the window open. */
  setGuard: (guard: (() => boolean) | null) => void;
  /** Closes the window without asking. */
  close: () => void;
}

export const WindowCloseContext = createContext<WindowClose | null>(null);

/**
 * Lets an app keep its window open when the user closes it, e.g. to ask about unsaved changes
 * (`guard` returns false and shows its own prompt). Returns a close that skips the guard.
 */
export function useCloseGuard(guard: () => boolean): () => void {
  const value = useContext(WindowCloseContext);
  const latest = useRef(guard);
  useEffect(() => {
    latest.current = guard;
  });
  useEffect(() => {
    value?.setGuard(() => latest.current());
    return () => value?.setGuard(null);
  }, [value]);
  return value?.close ?? noop;
}

const noop = () => undefined;
