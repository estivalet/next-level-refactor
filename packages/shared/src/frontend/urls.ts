import { MEDIA_KIND, THEME_ID } from './schema.ts';

// `nextlevel://` URLs (FR-THM-6). They name a game's media by id and kind, or a menu-art file by
// root and relative path; never a raw disk path. Main resolves them inside the configured roots.

export type ArtRoot = { kind: 'assets' } | { kind: 'pack'; themeId: string };

export type ParsedNextlevelUrl =
  | { kind: 'media'; gameId: number; mediaKind: string }
  | { kind: 'art'; root: ArtRoot; rel: string }
  | { kind: 'scrape-thumb'; providerGameId: number };

/** `version` (the file's mtime) changes the URL when a file is replaced, so no cached image stays. */
export function mediaUrl(gameId: number, kind: string, version?: number): string {
  const base = `nextlevel://media/${String(gameId)}/${kind}`;
  return version === undefined ? base : `${base}?v=${String(version)}`;
}

/** A scrape candidate's box thumbnail, fetched by main (the real URL carries credentials). */
export function scrapeThumbUrl(providerGameId: number): string {
  return `nextlevel://scrape-thumb/${String(providerGameId)}`;
}

export function artUrl(root: ArtRoot, rel: string): string {
  const prefix = root.kind === 'assets' ? 'assets' : `pack/${root.themeId}`;
  const path = rel.split('/').map(encodeURIComponent).join('/');
  return `nextlevel://art/${prefix}/${path}`;
}

/** A safe relative path segment: no traversal, separators, drive colons or control chars. */
function safeSegment(segment: string): boolean {
  if (segment === '' || segment === '.' || segment === '..') return false;
  // eslint-disable-next-line no-control-regex -- control characters are exactly what we refuse
  return !/[\\/:\u0000-\u001f]/.test(segment);
}

function decodeSegments(raw: string[]): string[] | null {
  try {
    const segments = raw.map(decodeURIComponent);
    return segments.length > 0 && segments.every(safeSegment) ? segments : null;
  } catch {
    return null;
  }
}

/** Parses a `nextlevel://` URL; null for anything that is not a well-formed, in-root reference. */
export function parseNextlevelUrl(url: string): ParsedNextlevelUrl | null {
  const match = /^nextlevel:\/\/(media|art|scrape-thumb)\/(.*)$/.exec(url);
  if (!match) return null;
  const parts = (match[2] ?? '').split('/');
  if (match[1] === 'scrape-thumb') {
    const id = match[2] ?? '';
    return /^[1-9]\d{0,15}$/.test(id) ? { kind: 'scrape-thumb', providerGameId: Number(id) } : null;
  }
  if (match[1] === 'media') {
    const [id, kindAndQuery, ...rest] = parts;
    const [kind, query, ...more] = (kindAndQuery ?? '').split('?');
    if (more.length > 0 || (query !== undefined && !/^v=\d{1,16}$/.test(query))) return null;
    if (rest.length > 0 || !id || !/^[1-9]\d{0,15}$/.test(id) || !kind || !MEDIA_KIND.test(kind)) {
      return null;
    }
    return { kind: 'media', gameId: Number(id), mediaKind: kind };
  }
  const [rootName, ...restParts] = parts;
  let root: ArtRoot;
  let relParts = restParts;
  if (rootName === 'assets') {
    root = { kind: 'assets' };
  } else if (rootName === 'pack') {
    const [themeId, ...rest] = restParts;
    if (!themeId || !THEME_ID.test(themeId)) return null;
    root = { kind: 'pack', themeId };
    relParts = rest;
  } else {
    return null;
  }
  const segments = decodeSegments(relParts);
  return segments ? { kind: 'art', root, rel: segments.join('/') } : null;
}
