import type { GameArtKind } from '@nextlevel/shared';

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
