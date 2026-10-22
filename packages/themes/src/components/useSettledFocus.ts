// Ported from NextLevelOS src/themes/components/useSettledFocus.ts @ 3d530b7.
import { useEffect, useState } from 'react';

/**
 * The last `key` that stayed unchanged for `delayMs`. The first key comes back at once; a run of
 * quick changes settles once, on the last one. When `resetKey` changes (a new level) the new key
 * comes back at once and debouncing resumes from there.
 */
export function useSettledFocus<K>(key: K, delayMs = 250, resetKey?: unknown): K {
  const [settled, setSettled] = useState(key);
  const [prevReset, setPrevReset] = useState(resetKey);
  let result = settled;
  if (!Object.is(resetKey, prevReset)) {
    setPrevReset(resetKey);
    setSettled(key);
    result = key;
  }
  useEffect(() => {
    const id = window.setTimeout(() => {
      setSettled(key);
    }, delayMs);
    return () => {
      window.clearTimeout(id);
    };
  }, [key, delayMs]);
  return result;
}
