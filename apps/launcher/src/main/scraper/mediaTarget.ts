import { orderedLocations, type Settings } from '@nextlevel/shared';
import { join } from 'node:path';

/**
 * The ROM file name without its last extension, verbatim; subfolders are ignored. Same rule as
 * the scan's `matchMedia`, so a written file is found again by the next scan (FR-SCR-4).
 */
export function romStem(relPath: string): string {
  const name = relPath.split(/[\\/]/).pop() ?? relPath;
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? name : name.slice(0, dot);
}

export interface MediaTargetGame {
  systemId: string;
  locationId: string | null;
  relPath: string;
}

/**
 * The media folder a scrape writes into (FR-SCR-4): `<location>/<system folder>/media` beside the
 * ROMs (the NextLevelOS convention), or `<central>/<systemId>` in central mode. A game whose
 * location was removed uses the first one; null when there is no location at all.
 */
export function mediaDir(
  game: MediaTargetGame,
  settings: Settings,
  system: { defaultFolderName: string } | undefined,
): string | null {
  const media = settings.storage.media;
  if (media.mode === 'central') return join(media.path, game.systemId);
  const locations = orderedLocations(settings.storage.locations);
  const location = locations.find((candidate) => candidate.id === game.locationId) ?? locations[0];
  if (!location) return null;
  const folder =
    settings.systems[game.systemId]?.folderName ?? system?.defaultFolderName ?? game.systemId;
  return join(location.path, folder, 'media');
}
