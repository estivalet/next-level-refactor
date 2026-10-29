/**
 * Systems the first-run wizard ticks for a new player (FR-ONB-1): NES, SNES, N64, Game Boy,
 * Game Boy Color, Game Boy Advance, Genesis/Mega Drive, Master System, PlayStation, PlayStation 2
 * and arcade (MAME). Every id is checked against systems.json by a test.
 */
export const POPULAR_SYSTEM_IDS: readonly string[] = [
  'nintendo-nes',
  'nintendo-snes',
  'nintendo-64',
  'nintendo-game-boy',
  'nintendo-game-boy-color',
  'nintendo-game-boy-advance',
  'sega-genesis',
  'sega-mega-drive',
  'sega-master-system',
  'sony-playstation',
  'sony-playstation-2',
  'mame',
];
