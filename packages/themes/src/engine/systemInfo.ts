// Ported from NextLevelOS src/themes/engine/systemInfo.ts @ 3d530b7. The candidates are art URLs
// of files the art index has (host.artUrl), so the fetch reads theme art, never a data file.

/** What themes read from `system-info/<name>.json`. Other keys are ignored. */
export interface SystemInfo {
  description: string;
}

const cache = new Map<string, Promise<SystemInfo | null>>();

/** Test hook: forgets every lookup. */
export function resetSystemInfoCache(): void {
  cache.clear();
}

async function readOne(url: string): Promise<SystemInfo | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const description = (data as { description?: unknown }).description;
    return typeof description === 'string' && description.trim()
      ? { description: description.trim() }
      : null;
  } catch {
    return null;
  }
}

/**
 * The first candidate that reads as an object with a non-empty `description`, or null. A
 * missing file, a non-OK response, bad JSON or a rejected fetch moves on to the next candidate;
 * never throws. Cached per candidate list (null included), so each file is read once per
 * session.
 */
export function loadSystemInfo(candidates: readonly string[]): Promise<SystemInfo | null> {
  if (candidates.length === 0) return Promise.resolve(null);
  const key = candidates.join('\n');
  let pending = cache.get(key);
  if (!pending) {
    pending = (async () => {
      for (const url of candidates) {
        const info = await readOne(url);
        if (info) return info;
      }
      return null;
    })();
    cache.set(key, pending);
  }
  return pending;
}
