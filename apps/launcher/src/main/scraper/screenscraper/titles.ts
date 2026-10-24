// Title normalization and fuzzy matching, ported from NextLevelOS scrappers/ScreenScraper.py
// (normalize_title, extract_region, _query_variants, levenshtein_similarity) @ 3d530b7.

/** Region words (in tags or titles) → ScreenScraper region code. */
export const REGIONS: Readonly<Record<string, string>> = {
  usa: 'us',
  us: 'us',
  u: 'us',
  europe: 'eu',
  eur: 'eu',
  euro: 'eu',
  eu: 'eu',
  pal: 'eu',
  japan: 'jp',
  jap: 'jp',
  jpn: 'jp',
  jp: 'jp',
  world: 'wor',
  wor: 'wor',
  asia: 'asia',
  australia: 'au',
  au: 'au',
  brazil: 'br',
  bra: 'br',
  korea: 'kr',
  kor: 'kr',
  france: 'fr',
  germany: 'de',
  italy: 'it',
  spain: 'es',
};

/** Words that never help a search: regions, languages, release states. */
const IGNORE_WORDS = new Set([
  ...Object.keys(REGIONS),
  'en',
  'fr',
  'de',
  'es',
  'it',
  'pt',
  'rev',
  'revision',
  'beta',
  'proto',
  'prototype',
  'demo',
  'sample',
  'hack',
  'patched',
  'bootleg',
  'translation',
  'unl',
]);

/** ScreenScraper is inconsistent about leading articles, so both sides drop them. */
const STOPWORDS = new Set(['the']);

export const removeAccents = (value: string): string =>
  value.normalize('NFD').replace(/\p{Mn}/gu, '');

/** Like Python's `Path(name).stem`: the last path segment without its last extension. */
function fileStem(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const dot = base.lastIndexOf('.');
  return dot > 0 && dot < base.length - 1 ? base.slice(0, dot) : base;
}

/**
 * A ROM file name (default) or a plain title (`isTitle`) as a search query: no tags, accents,
 * punctuation, region/release words or leading article; lowercase, single spaces. In title mode
 * nothing is treated as a path or an extension ("Dr. Gizmo" keeps "gizmo").
 */
export function normalizeTitle(value: string, opts: { isTitle?: boolean } = {}): string {
  const name = removeAccents(opts.isTitle ? value : fileStem(value))
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[_.:;,!?/'-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return name
    .split(' ')
    .filter((word) => word !== '' && !IGNORE_WORDS.has(word) && !STOPWORDS.has(word))
    .join(' ');
}

/** The first region named in a `(…)` or `[…]` tag of a file name, as a region code. */
export function extractRegion(filename: string): string | null {
  for (const match of filename.matchAll(/[([]([^()[\]]+)[)\]]/g)) {
    const tag = removeAccents(match[1] ?? '')
      .trim()
      .toLowerCase();
    for (const part of tag.split(/[,;/+]/)) {
      const region = REGIONS[part.trim()];
      if (region) return region;
    }
  }
  return null;
}

/**
 * The query plus relaxed forms (one or two words dropped at either end) for ScreenScraper's
 * fussy search; every variant keeps two or more words, a one-word query stays as is.
 */
export function queryVariants(normalized: string): string[] {
  const tokens = normalized.split(' ').filter(Boolean);
  const variants = [normalized];
  if (tokens.length >= 3) {
    for (const drop of tokens.length >= 4 ? [1, 2] : [1]) {
      variants.push(tokens.slice(0, -drop).join(' '), tokens.slice(drop).join(' '));
    }
  }
  const unique = [
    ...new Set(variants.map((v) => v.trim()).filter((v) => v.split(' ').length >= 2)),
  ];
  return unique.length > 0 ? unique : [normalized];
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const [long, short] = a.length >= b.length ? [a, b] : [b, a];
  let previous = Array.from({ length: short.length + 1 }, (_, i) => i);
  for (let i = 1; i <= long.length; i++) {
    const current = [i];
    for (let j = 1; j <= short.length; j++) {
      const cost = long[i - 1] === short[j - 1] ? 0 : 1;
      current.push(
        Math.min((current[j - 1] ?? 0) + 1, (previous[j] ?? 0) + 1, (previous[j - 1] ?? 0) + cost),
      );
    }
    previous = current;
  }
  return previous[short.length] ?? 0;
}

/** 0–100: 100 minus the edit distance as a share of the longer string. */
export function similarity(a: string, b: string): number {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (left === right) return 100;
  if (!left || !right) return 0;
  return (1 - levenshtein(left, right) / Math.max(left.length, right.length)) * 100;
}
