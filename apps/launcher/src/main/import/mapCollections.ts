import { LegacyGameSchema, type ImportItem } from '@nextlevel/shared';
import { discGroupOf, normalizeRelPath, parseYear, text } from './legacyGame.ts';
import type { LegacyFiles } from './readLegacy.ts';
import { Tally } from './tally.ts';

/** A collection member: the game it points at, plus a title for a game no system list has. */
export interface CollectionEntryImport {
  systemId: string;
  relPath: string;
  discGroup: string | null;
  title?: string;
  year?: number;
}

export interface CollectionImport {
  name: string;
  entries: CollectionEntryImport[];
}

/** Launch fields NextLevelOS lets a collection entry set for that collection only. */
const LAUNCH_FIELDS = ['config', 'alt_game_config', 'shader', 'core', 'emulator'] as const;

/**
 * NextLevelOS collection gamelists → collections (FR-IMP-1). A gamelist is a collection when its
 * name isn't a launcher key. Entries keep file order and point at games by (system, file);
 * unknown systems, duplicates and per-collection launch fields are reported.
 */
export function mapCollections(
  files: LegacyFiles,
  match: (name: string) => string | null,
): { collections: CollectionImport[]; items: ImportItem[] } {
  const tally = new Tally();
  const collections: CollectionImport[] = [];
  for (const list of files.gamelists) {
    if (list.name in files.launchers) continue;
    const entries: CollectionEntryImport[] = [];
    const seen = new Set<string>();
    for (const raw of list.games) {
      const parsed = LegacyGameSchema.safeParse(raw);
      const relPath = parsed.success ? normalizeRelPath(parsed.data.filename) : null;
      if (!parsed.success || !relPath) {
        tally.add('collection', list.name, 'invalidEntry');
        continue;
      }
      const game = parsed.data;
      const systemName = text(game.system) ?? '';
      const systemId = match(systemName);
      if (!systemId) {
        tally.add('collection', list.name, 'unknownCollectionSystem', systemName || undefined);
        continue;
      }
      const key = `${systemId}/${relPath.toLowerCase()}`;
      if (seen.has(key)) {
        tally.add('collection', list.name, 'duplicateEntry');
        continue;
      }
      seen.add(key);
      if (LAUNCH_FIELDS.some((field) => text(game[field]))) {
        tally.add('collection', list.name, 'collectionLaunchFields');
      }
      const title = text(game.title);
      const year = parseYear(game.year);
      entries.push({
        systemId,
        relPath,
        discGroup: discGroupOf(relPath),
        ...(title ? { title } : {}),
        ...(year ? { year } : {}),
      });
    }
    collections.push({ name: list.name, entries });
  }
  return { collections, items: tally.items() };
}
