import { realpath as fsRealpath, stat } from 'node:fs/promises';
import { join, sep } from 'node:path';
import type { ParsedNextlevelUrl } from '@nextlevel/shared';

export interface ResolveDeps {
  mediaPath: (gameId: number, kind: string) => string | null;
  assetsPath: string | null;
  themesPath: string | null;
  realpath?: (path: string) => Promise<string>;
}

const inside = (root: string, path: string) => {
  const r = root.toLowerCase();
  const p = path.toLowerCase();
  return p.startsWith(r.endsWith(sep) ? r : r + sep);
};

/**
 * The file a `nextlevel://` URL names, or null (FR-THM-6). Game media comes from the media index;
 * art is joined under its root (assets folder or `<themesPath>/<themeId>`) and must still be
 * inside that root after resolving links and junctions, and be a file.
 */
export async function resolveNextlevelPath(
  parsed: ParsedNextlevelUrl,
  deps: ResolveDeps,
): Promise<string | null> {
  if (parsed.kind === 'media') return deps.mediaPath(parsed.gameId, parsed.mediaKind);
  if (parsed.kind === 'scrape-thumb' || parsed.kind === 'catalog-art') return null;
  const base = parsed.root.kind === 'assets' ? deps.assetsPath : deps.themesPath;
  if (!base) return null;
  const root = parsed.root.kind === 'pack' ? join(base, parsed.root.themeId) : base;
  const candidate = join(root, ...parsed.rel.split('/'));
  const realpath = deps.realpath ?? fsRealpath;
  try {
    const [realRoot, realFile] = await Promise.all([realpath(root), realpath(candidate)]);
    if (!inside(realRoot, realFile)) return null;
    return (await stat(realFile)).isFile() ? candidate : null;
  } catch {
    return null;
  }
}
