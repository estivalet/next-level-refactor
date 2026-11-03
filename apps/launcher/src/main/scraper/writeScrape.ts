import {
  AppErrorException,
  type GameArtKind,
  type GameDetails,
  type ScrapeApplyResult,
  type ScrapeField,
  type ScrapeProvider,
} from '@nextlevel/shared';
import type { EmitEvent } from '../ipc/events.ts';
import type { GameRepository } from '../library/GameRepository.ts';
import type { MediaRepository } from '../library/MediaRepository.ts';
import type { ScrapeRepository } from '../library/ScrapeRepository.ts';
import { romStem } from './mediaTarget.ts';
import type { MediaWriter, WriteResult } from './MediaWriter.ts';
import { isImage } from './sniff.ts';

/** Failures of the service, not of one file: a batch pauses on them instead of going on. */
export const TRANSPORT = new Set([
  'SCRAPER_QUOTA',
  'SCRAPER_CREDENTIALS',
  'SCRAPER_NETWORK',
  'SCRAPER_UNAVAILABLE',
]);

export interface WriteScrapeDeps {
  games: Pick<GameRepository, 'get' | 'applyScraped'>;
  media: Pick<MediaRepository, 'upsert' | 'repoint'>;
  scrapes: Pick<ScrapeRepository, 'set'>;
  writer: Pick<MediaWriter, 'write'>;
  /** Runs `fn` in one library transaction. */
  transaction: (fn: () => void) => void;
  emit: EmitEvent;
  clock: () => Date;
  /** Where the game's art goes (Settings → Storage), null when there is no media folder. */
  mediaDir: (game: GameDetails) => string | null;
}

export interface WriteScrapeInput {
  game: GameDetails;
  provider: ScrapeProvider;
  /** null for a source without ids (Gemini, FR-SCR-7). */
  providerGameId: number | null;
  kinds: readonly GameArtKind[];
  /** The kind's file; null when the source has none. A throw is a failed download. */
  fetchArt: (kind: GameArtKind) => Promise<{ bytes: Buffer; format: string } | null>;
  values: Partial<Record<ScrapeField, string | number | null>>;
  /** Ticked fields are written even when locked, and stay locked (D19). */
  overrideLocked: readonly ScrapeField[];
  candidates: number;
  /** From a batch: transport failures reject (the batch pauses). */
  batch: boolean;
}

/**
 * Writes a scrape's art (media writer + media index), fields and scrape status in one
 * transaction, then announces the change (FR-SCR-1, FR-SCR-5); shared by every provider.
 */
export async function writeScrape(
  deps: WriteScrapeDeps,
  input: WriteScrapeInput,
): Promise<ScrapeApplyResult> {
  const { game } = input;
  const dir = deps.mediaDir(game);
  const stem = romStem(game.relPath);
  const written: Array<{ kind: GameArtKind; file: WriteResult }> = [];
  const failed: ScrapeApplyResult['failed'] = [];
  for (const kind of input.kinds) {
    let file: { bytes: Buffer; format: string } | null;
    try {
      file = await input.fetchArt(kind);
      if (file) {
        const usable = kind === 'video' ? file.bytes.length > 0 : isImage(file.bytes);
        if (!usable) throw new Error('not media');
      }
    } catch (error) {
      if (input.batch && error instanceof AppErrorException && TRANSPORT.has(error.error.code)) {
        throw error;
      }
      failed.push({ kind, code: 'download' });
      continue;
    }
    if (!file) {
      failed.push({ kind, code: 'notAvailable' });
      continue;
    }
    try {
      if (!dir) throw new Error('no media folder');
      written.push({
        kind,
        file: await deps.writer.write(dir, kind, stem, file.bytes, file.format),
      });
    } catch {
      failed.push({ kind, code: 'write' });
    }
  }
  const now = deps.clock();
  deps.transaction(() => {
    for (const { kind, file } of written) {
      const { replaced, ...row } = file;
      deps.media.repoint(replaced, row);
      deps.media.upsert({ gameId: game.id, kind, ...row });
    }
    deps.games.applyScraped(
      game.id,
      input.values,
      { overrideLocked: [...input.overrideLocked] },
      now,
    );
    const savedNothing =
      written.length === 0 &&
      failed.length > 0 &&
      !Object.values(input.values).some((v) => v !== null);
    deps.scrapes.set(game.id, {
      provider: input.provider,
      status: savedNothing ? 'failed' : 'scraped',
      providerGameId: input.providerGameId,
      candidates: input.candidates,
      error: savedNothing ? (failed[0]?.code ?? null) : null,
      scrapedAt: now.toISOString(),
    });
  });
  deps.emit('library.changed', { systems: [game.systemId], gameIds: [game.id] });
  return { written: written.map((w) => w.kind), failed, game: deps.games.get(game.id) };
}
