import type { ExportFormat, GameExportRequest, GameExportResult } from '@nextlevel/shared';
import { atomicWrite } from '../fs/atomicWrite.ts';
import type { GameExportReader } from '../library/GameExportReader.ts';
import { renderExport } from './formats.ts';

const EXTENSIONS: Record<ExportFormat, string> = { csv: 'csv', json: 'json', gamelistXml: 'xml' };

/** The Save dialog's suggestion: the scope's name made safe for Windows; ES wants gamelist.xml. */
export function exportFileName(title: string, format: ExportFormat): string {
  if (format === 'gamelistXml') return 'gamelist.xml';
  const safe = title
    // eslint-disable-next-line no-control-regex -- control characters aren't allowed in names
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/[. ]+$/, '')
    .trim();
  return `${safe || 'games'}.${EXTENSIONS[format]}`;
}

export interface ExportDeps {
  reader: Pick<GameExportReader, 'read'>;
  /** Native Save dialog for the format; null when cancelled. */
  pickPath: (defaultName: string, format: ExportFormat) => Promise<string | null>;
  clock: () => Date;
}

/**
 * Writes a scope's games to a file the user picks (FR-LIB-11). The games are read first, so a
 * scope that is gone fails before any dialog; the file is written atomically.
 */
export async function exportGames(
  deps: ExportDeps,
  request: GameExportRequest,
): Promise<GameExportResult> {
  const games = deps.reader.read(request.scope, request.view);
  const path = await deps.pickPath(exportFileName(request.title, request.format), request.format);
  if (!path) return { status: 'cancelled' };
  const text = renderExport(request.format, games, request.fields, {
    title: request.title,
    exportedAt: deps.clock().toISOString(),
  });
  await atomicWrite(path, text);
  return { status: 'saved', count: games.length };
}
