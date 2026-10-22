// Ported from NextLevelOS src/themes/components/useSystemInfo.ts @ 3d530b7: the candidates come
// from the art index (pack, then shared art), so a name without a file reads nothing.
import { useEffect, useState } from 'react';
import { loadSystemInfo } from '../engine/systemInfo.ts';
import { useThemeArt } from '../engine/useThemeArt.ts';

/**
 * The description in `system-info/<name>.json` for the focused menu item, loaded once `name` has
 * stayed put for `settleMs`. Null while loading, without a usable file, and for a result that
 * belongs to an earlier name.
 */
export function useSystemInfo(name: string | null, settleMs = 250): { description: string | null } {
  const art = useThemeArt();
  // Art URLs are percent-encoded, so a newline never occurs inside one.
  const key = name ? art.systemInfo(name).join('\n') : '';
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

  return { description: result && result.key === key ? result.description : null };
}
