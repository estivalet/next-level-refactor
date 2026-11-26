import type { CleanupScriptRequest, CleanupScriptResult } from '@nextlevel/shared';
import { atomicWrite } from '../fs/atomicWrite.ts';
import type { DeleteLaterGame, GameExportReader } from '../library/GameExportReader.ts';
import type { CleanupGame } from './cleanupFiles.ts';
import { renderCleanupScript } from './cleanupScript.ts';
import { safeFileName } from './exportGames.ts';

export interface CleanupExportDeps {
  reader: Pick<GameExportReader, 'deleteLaterGames'>;
  /** Finds the games' files on disk (`collectCleanupFiles` with the current settings). */
  files: (games: readonly DeleteLaterGame[]) => Promise<CleanupGame[]>;
  /** Native Save dialog for a `.ps1`; null when cancelled. */
  pickPath: (defaultName: string) => Promise<string | null>;
  clock: () => Date;
  /** The launcher-language string for an i18n key. */
  text: (key: string) => string;
}

/**
 * Writes the Delete later tab's cleanup script to a file the user picks (FR-LIB-20, US-C14).
 * The games are read first, so a gone scope fails before any dialog; the disk is searched only
 * once a path is picked. Nothing is deleted here: the owner runs the script.
 */
export async function exportCleanupScript(
  deps: CleanupExportDeps,
  request: CleanupScriptRequest,
): Promise<CleanupScriptResult> {
  const games = deps.reader.deleteLaterGames(request.scope);
  const name = `delete-later-${safeFileName(request.title) || 'games'}.ps1`;
  const path = await deps.pickPath(name);
  if (!path) return { status: 'cancelled' };
  const found = await deps.files(games);
  const script = renderCleanupScript(found, {
    scope: request.title,
    exportedAt: deps.clock().toISOString(),
    text: deps.text,
  });
  await atomicWrite(path, script);
  return {
    status: 'saved',
    games: found.length,
    files: found.reduce((total, game) => total + game.files.length, 0),
  };
}
