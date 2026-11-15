// Ported from NextLevelOS src/themes/components/useSystemInfo.ts @ 3d530b7: the candidates come
// from the art index (pack, then shared art), so a name without a file reads nothing.
import type { ThemeSystemInfo } from '@nextlevel/shared';
import { useEffect, useState } from 'react';
import { loadSystemInfo } from '../engine/systemInfo.ts';
import { useThemeArt } from '../engine/useThemeArt.ts';
import { useThemeHost } from '../engine/useThemeNavigation.ts';
import type { ThemeHost } from '../host/ThemeHost.ts';

/**
 * Museum entries per host and system id. The cache listens to its host from the moment it is
 * created, so an entry changed while no theme is mounted is still dropped: `system-info-changed`
 * drops that system, `library-changed` drops all (owned top games depend on the library).
 */
const entries = new WeakMap<ThemeHost, Map<string, ThemeSystemInfo | null>>();

function cacheFor(host: ThemeHost): Map<string, ThemeSystemInfo | null> {
  let byId = entries.get(host);
  if (!byId) {
    const created = new Map<string, ThemeSystemInfo | null>();
    byId = created;
    entries.set(host, created);
    host.onEvent((event) => {
      if (event.type === 'system-info-changed') created.delete(event.systemId);
      else if (event.type === 'library-changed') created.clear();
    });
  }
  return byId;
}

/**
 * FR-MUS-4: the museum entry for a system, loaded once `systemId` has stayed put for `settleMs`
 * and reloaded on `system-info-changed` for that system. Null while loading or unknown.
 */
export function useThemeSystemInfo(
  systemId: string | null,
  settleMs = 250,
): ThemeSystemInfo | null {
  const host = useThemeHost();
  // Bumped when a load settles or the entry changes, to re-read the cache.
  const [revision, setRevision] = useState(0);

  const known = cacheFor(host);

  // The cache drops stale entries itself (it subscribed first); this only re-reads it.
  useEffect(
    () =>
      host.onEvent((event) => {
        if (event.type === 'library-changed' || event.type === 'system-info-changed') {
          setRevision((n) => n + 1);
        }
      }),
    [host],
  );

  const loaded = !!systemId && known.has(systemId);

  useEffect(() => {
    if (!systemId || loaded) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      void host.getSystemInfo(systemId).then(
        (info) => {
          if (cancelled) return;
          known.set(systemId, info);
          setRevision((n) => n + 1);
        },
        () => undefined,
      );
    }, settleMs);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [host, known, systemId, loaded, revision, settleMs]);

  return (systemId && known.get(systemId)) || null;
}

/**
 * The description for the focused menu item: the museum entry's for a system node (FR-MUS-4),
 * else the one in `system-info/<name>.json`, loaded once the node has stayed put for `settleMs`.
 * Null while loading, without a usable description, and for a result that belongs to an earlier
 * name.
 */
export function useSystemInfo(
  node: { name: string; systemId?: string | null | undefined } | null,
  settleMs = 250,
): { description: string | null } {
  const art = useThemeArt();
  const name = node?.name ?? null;
  const museum = useThemeSystemInfo(node?.systemId ?? null, settleMs);
  const museumDescription = museum?.description ?? null;
  // Art URLs are percent-encoded, so a newline never occurs inside one.
  const key = name && !museumDescription ? art.systemInfo(name).join('\n') : '';
  const [result, setResult] = useState<{ key: string; description: string | null } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void loadSystemInfo(key.split('\n')).then((info) => {
        if (!cancelled) setResult({ key, description: info?.description ?? null });
      });
    }, settleMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [key, settleMs]);

  if (museumDescription) return { description: museumDescription };
  return { description: result && result.key === key ? result.description : null };
}
