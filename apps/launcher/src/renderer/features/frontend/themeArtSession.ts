import { useSyncExternalStore } from 'react';

/**
 * Session-only art state shared by Settings → Themes and the front-end (FR-THM-2): the themes
 * previewed without the shared art folder, and a counter per theme bumped by Rescan art so an
 * open theme loads its art index again. Nothing here is saved.
 */
export interface ThemeArtSession {
  preview: ReadonlySet<string>;
  rescans: Readonly<Record<string, number>>;
}

const EMPTY: ThemeArtSession = { preview: new Set(), rescans: {} };
let state = EMPTY;
const listeners = new Set<() => void>();

function set(next: ThemeArtSession) {
  state = next;
  listeners.forEach((listener) => {
    listener();
  });
}

export function setPreviewWithoutFallback(themeId: string, on: boolean): void {
  if (state.preview.has(themeId) === on) return;
  const preview = new Set(state.preview);
  if (on) preview.add(themeId);
  else preview.delete(themeId);
  set({ ...state, preview });
}

export function markArtRescanned(themeId: string): void {
  set({ ...state, rescans: { ...state.rescans, [themeId]: (state.rescans[themeId] ?? 0) + 1 } });
}

/** Test hook: back to the start of a session. */
export function resetThemeArtSession(): void {
  set(EMPTY);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useThemeArtSession(): ThemeArtSession {
  return useSyncExternalStore(subscribe, () => state);
}
