import { GAME_ART_KINDS, type GameArtKind, type ScrapeField } from '@nextlevel/shared';
import type { LbGame, LbImage } from './parseMetadata.ts';

/**
 * LaunchBox image types per NextLevel art kind, best first (spec §5, FR-SCR-6). LaunchBox has no
 * videos (only YouTube links), so `video` stays with ScreenScraper.
 */
export const LB_ART_TYPES: Readonly<Record<GameArtKind, readonly string[]>> = {
  'box-front': ['Box - Front', 'Box - Front - Reconstructed', 'Fanart - Box - Front'],
  'box-back': ['Box - Back', 'Box - Back - Reconstructed', 'Fanart - Box - Back'],
  'box-3d': ['Box - 3D'],
  'cart-front': ['Cart - Front', 'Disc', 'Fanart - Cart - Front', 'Fanart - Disc'],
  fanart: ['Fanart - Background'],
  'screenshot-game-play': ['Screenshot - Gameplay'],
  'screenshot-game-title': ['Screenshot - Game Title'],
  'logo-clear': ['Clear Logo'],
  marquee: ['Arcade - Marquee', 'Banner'],
  video: [],
};

/** Every image type the index keeps. */
export const LB_STORED_TYPES: ReadonlySet<string> = new Set(Object.values(LB_ART_TYPES).flat());

/**
 * LaunchBox region names to Settings → Scraper region codes; an image without a region counts as
 * world-wide.
 */
export const LB_REGION_CODES: Readonly<Record<string, string>> = {
  'North America': 'us',
  'United States': 'us',
  USA: 'us',
  Canada: 'us',
  Europe: 'eu',
  'United Kingdom': 'eu',
  Germany: 'eu',
  France: 'eu',
  Spain: 'eu',
  Italy: 'eu',
  Japan: 'jp',
  World: 'wor',
  Brazil: 'br',
  Korea: 'kr',
  Australia: 'au',
  China: 'cn',
};

const regionCode = (image: LbImage): string =>
  image.region === null ? 'wor' : (LB_REGION_CODES[image.region] ?? image.region.toLowerCase());

/**
 * The image per art kind: the first LaunchBox type of LB_ART_TYPES[kind] that has any image,
 * then the image whose region comes first in `regions`, else that type's first image.
 */
export function selectArt(
  images: readonly LbImage[],
  regions: readonly string[],
): Partial<Record<GameArtKind, LbImage>> {
  const chosen: Partial<Record<GameArtKind, LbImage>> = {};
  for (const kind of GAME_ART_KINDS) {
    for (const type of LB_ART_TYPES[kind]) {
      const ofType = images.filter((image) => image.type === type);
      if (ofType.length === 0) continue;
      const rank = (image: LbImage) => {
        const index = regions.indexOf(regionCode(image));
        return index < 0 ? regions.length : index;
      };
      chosen[kind] = ofType.reduce((best, image) => (rank(image) < rank(best) ? image : best));
      break;
    }
  }
  return chosen;
}

/** A LaunchBox game's values for the library's scrape fields. */
export function lbValues(game: LbGame): Record<ScrapeField, string | number | null> {
  return {
    title: game.name,
    description: game.overview,
    year: game.year,
    developer: game.developer,
    publisher: game.publisher,
    genre: game.genres,
    players: game.players,
    rating: game.rating,
  };
}
