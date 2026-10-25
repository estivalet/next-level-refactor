// Picking one ScreenScraper media item per art kind, ported from NextLevelOS
// scrappers/ScreenScraper.py (MEDIA_MAPPING, _select_nextlevel_media, _get_mapping_key,
// _resolver_target_extension) @ 3d530b7, with the D16 kind names.
import type { GameArtKind } from '@nextlevel/shared';
import { isRecord, text, type SsGame, type SsMedia } from './types.ts';

/** ScreenScraper media type (lowercase) → art kind (plan Global Constraints). */
const MEDIA_KINDS: Readonly<Record<string, GameArtKind>> = {
  'box-2d': 'box-front',
  'box-2d-back': 'box-back',
  'box-3d': 'box-3d',
  'support-2d': 'cart-front',
  fanart: 'fanart',
  video: 'video',
  ss: 'screenshot-game-play',
  sstitle: 'screenshot-game-title',
  wheel: 'logo-clear',
  screenmarquee: 'marquee',
};

const TYPE_REGIONS = ['us', 'eu', 'wor', 'jp'];

/** `wheel`, `wheel-us`, `wheel_eu` and `wheel(jp)` all map to `logo-clear`. */
function kindOf(type: string): GameArtKind | null {
  const exact = MEDIA_KINDS[type];
  if (exact) return exact;
  for (const region of TYPE_REGIONS) {
    for (const separator of ['-', '_']) {
      const suffix = `${separator}${region}`;
      const base = type.endsWith(suffix) ? MEDIA_KINDS[type.slice(0, -suffix.length)] : undefined;
      if (base) return base;
    }
  }
  const tagged = /^(.+?)[([](us|eu|wor|jp)[)\]]$/.exec(type);
  return tagged ? (MEDIA_KINDS[(tagged[1] ?? '').trim()] ?? null) : null;
}

/** One media item per kind: the first one in the best region (unlisted regions last). */
export function selectMedia(
  game: SsGame,
  regions: readonly string[],
): Partial<Record<GameArtKind, SsMedia>> {
  const rank = (item: SsMedia) => {
    const index = regions.indexOf(text(item.region)?.toLowerCase() ?? '');
    return index < 0 ? regions.length : index;
  };
  const selected: Partial<Record<GameArtKind, SsMedia>> = {};
  for (const item of Array.isArray(game.medias) ? game.medias.filter(isRecord) : []) {
    const media = item as SsMedia;
    const type = text(media.type)?.toLowerCase();
    const kind = type ? kindOf(type) : null;
    if (!kind || !text(media.url)) continue;
    const current = selected[kind];
    if (!current || rank(media) < rank(current)) selected[kind] = media;
  }
  return selected;
}

/** The extension NextLevelOS loads for a kind (D17): video mp4, fanart jpg or png, else png. */
export function targetExtension(kind: GameArtKind, format: string): '.png' | '.jpg' | '.mp4' {
  if (kind === 'video') return '.mp4';
  if (kind === 'fanart' && /^jpe?g$/i.test(format.replace(/^\./, ''))) return '.jpg';
  return '.png';
}
