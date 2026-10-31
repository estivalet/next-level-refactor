import { useState } from 'react';

export type ViewMode = 'grid' | 'list';

const storageKey = (key: string) => `nextlevel.library.view.${key}`;

function read(key: string): ViewMode {
  try {
    return localStorage.getItem(storageKey(key)) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

/**
 * Grid or list for one place (the home, or a scope), remembered on this machine (D61, D62); the
 * renderer's storage lives in the portable data folder. Grid when nothing is stored.
 */
export function useViewMode(key: string): [ViewMode, (mode: ViewMode) => void] {
  const [stored, setStored] = useState({ key, mode: read(key) });
  const mode = stored.key === key ? stored.mode : read(key);
  const set = (next: ViewMode) => {
    setStored({ key, mode: next });
    try {
      localStorage.setItem(storageKey(key), next);
    } catch {
      // Storage can be unavailable; the choice then lasts while the Library is open.
    }
  };
  return [mode, set];
}
