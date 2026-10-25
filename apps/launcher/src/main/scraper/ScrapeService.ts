import {
  AppErrorException,
  ERROR_CODES,
  GAME_ART_KINDS,
  SCRAPE_FIELDS,
  scrapeThumbUrl,
  type GameArtKind,
  type GameDetails,
  type ScrapeApplyInput,
  type ScrapeApplyResult,
  type ScrapeCandidate,
  type ScrapeField,
  type ScrapePreview,
  type ScrapePreviewInput,
  type ScrapeSearchInput,
  type ScrapeSearchResult,
  type Settings,
} from '@nextlevel/shared';
import type { EmitEvent } from '../ipc/events.ts';
import type { GameRepository } from '../library/GameRepository.ts';
import type { MediaRepository } from '../library/MediaRepository.ts';
import type { ScrapeRepository } from '../library/ScrapeRepository.ts';
import type { RomHashes } from './hashRom.ts';
import { mediaDir, romStem } from './mediaTarget.ts';
import { imageType, isImage } from './sniff.ts';
import type { MediaWriter, WriteResult } from './MediaWriter.ts';
import type { ScreenScraperClient } from './screenscraper/client.ts';
import { selectMedia } from './screenscraper/mediaSelect.ts';
import {
  candidateRegion,
  candidateYear,
  extractMetadata,
  gameName,
  gameNames,
} from './screenscraper/metadata.ts';
import { rankCandidates, SEARCH_THRESHOLD } from './screenscraper/rank.ts';
import { extractRegion, normalizeTitle, queryVariants } from './screenscraper/titles.ts';
import { positiveInt, text, type SsGame } from './screenscraper/types.ts';

export interface ScrapeServiceDeps {
  client: Pick<ScreenScraperClient, 'identify' | 'search' | 'game' | 'download'>;
  games: Pick<GameRepository, 'get' | 'applyScraped' | 'filePath' | 'location'>;
  media: Pick<MediaRepository, 'kindsByGame' | 'upsert' | 'repoint'>;
  scrapes: Pick<ScrapeRepository, 'set'>;
  writer: Pick<MediaWriter, 'write'>;
  /** Runs `fn` in one library transaction. */
  transaction: (fn: () => void) => void;
  settings: () => Settings;
  system: (
    systemId: string,
  ) => { defaultFolderName: string; scraper: { screenscraperId?: number | undefined } } | undefined;
  hash: (path: string) => Promise<RomHashes | null>;
  emit: EmitEvent;
  clock: () => Date;
  /** A scan or import is running: its index write would undo an apply's rows. */
  blocked: () => boolean;
}

export interface ApplyOptions {
  candidates?: number;
  regions?: readonly string[];
  /** From a batch: quota, credential and network failures reject the apply (it pauses). */
  batch?: boolean;
}

/** Failures of the service, not of one file: a batch pauses on them instead of going on. */
const TRANSPORT = new Set([
  'SCRAPER_QUOTA',
  'SCRAPER_CREDENTIALS',
  'SCRAPER_NETWORK',
  'SCRAPER_UNAVAILABLE',
]);

const MAX_THUMBS = 200;
/** Candidates past this many get no thumbnail: each costs a rate-limited request. */
const THUMBS_PER_SEARCH = 8;

const fail = (code: 'NO_SCRAPER_SYSTEM' | 'BUSY', details?: unknown): never => {
  throw new AppErrorException({ code, message: ERROR_CODES[code], details });
};

/** Description/genre languages: the setting, else the app language, then English (plan). */
function languages(settings: Settings): string[] {
  const chosen = settings.scraper.languagePriority;
  const base = chosen.length > 0 ? chosen : [settings.general.language.split('-')[0] ?? 'en'];
  return base.includes('en') ? base : [...base, 'en'];
}

/** The format a downloaded item is in: the API's `format`, else the response type. */
function formatOf(item: { format?: unknown }, contentType: string | null): string {
  return text(item.format) ?? contentType?.split(';')[0]?.split('/')[1] ?? 'png';
}

const currentValue = (game: GameDetails, field: ScrapeField): string | number | null => game[field];

/**
 * Single-game scrape (FR-SCR-1, FR-SCR-5, US-C5): search by hash then title, preview what
 * ScreenScraper has against what the game has, apply the chosen art and fields. ScreenScraper
 * URLs never leave this service: candidates carry `nextlevel://scrape-thumb/<id>` instead.
 */
export class ScrapeService {
  /** Box thumbnail URL per candidate id, from recent searches (oldest dropped first). */
  private readonly thumbs = new Map<number, string>();
  private readonly applying = new Set<number>();

  constructor(private readonly deps: ScrapeServiceDeps) {}

  private screenscraperId(systemId: string): number {
    const id =
      this.deps.settings().systems[systemId]?.screenscraperId ??
      this.deps.system(systemId)?.scraper.screenscraperId;
    return id ?? fail('NO_SCRAPER_SYSTEM', { systemId });
  }

  private candidate(game: SsGame, name: string, similarity: number, index = 0): ScrapeCandidate {
    const providerGameId = positiveInt(game.id) ?? 0;
    const box = selectMedia(game, this.deps.settings().scraper.regionPriority)['box-front'];
    const url = box && index < THUMBS_PER_SEARCH ? text(box.url) : null;
    if (url) {
      this.thumbs.delete(providerGameId);
      this.thumbs.set(providerGameId, url);
      if (this.thumbs.size > MAX_THUMBS) this.thumbs.delete(this.thumbs.keys().next().value ?? 0);
    }
    return {
      providerGameId,
      name,
      year: candidateYear(game),
      region: candidateRegion(game),
      similarity,
      thumb: url ? scrapeThumbUrl(providerGameId) : null,
    };
  }

  async search(input: ScrapeSearchInput): Promise<ScrapeSearchResult> {
    const game = this.deps.games.get(input.gameId);
    const systemId = this.screenscraperId(game.systemId);
    if (input.title === undefined && !game.missing) {
      const hashes = await this.deps.hash(this.deps.games.filePath(game.id).path);
      const romName = game.relPath.split('/').pop() ?? game.relPath;
      const hit = hashes ? await this.deps.client.identify(hashes, romName, systemId) : null;
      if (hit) {
        const name = gameNames(hit)[0] ?? game.title;
        return { method: 'hash', candidates: [this.candidate(hit, name, 100)] };
      }
    }
    const query = input.title ?? game.title;
    const normalized = normalizeTitle(query, { isTitle: true });
    const region = extractRegion(game.relPath.split('/').pop() ?? '');
    for (const variant of normalized ? queryVariants(normalized) : []) {
      const found = await this.deps.client.search(
        variant,
        systemId,
        input.refresh ? { refresh: true } : {},
      );
      const matches = rankCandidates(found, {
        normalized,
        matched: variant,
        region,
        threshold: SEARCH_THRESHOLD,
        isTitle: true,
      });
      if (matches.length > 0) {
        return {
          method: 'title',
          candidates: matches.map((m, i) => this.candidate(m.game, m.name, m.similarity, i)),
        };
      }
    }
    return { method: 'title', candidates: [] };
  }

  async preview(input: ScrapePreviewInput): Promise<ScrapePreview> {
    const game = this.deps.games.get(input.gameId);
    const remote = await this.deps.client.game(
      input.providerGameId,
      this.screenscraperId(game.systemId),
    );
    const settings = this.deps.settings();
    const available = selectMedia(remote, settings.scraper.regionPriority);
    const local = new Set(this.deps.media.kindsByGame([game.id]).get(game.id) ?? []);
    const scraped = this.scrapedValues(remote, settings);
    const art = Object.fromEntries(
      GAME_ART_KINDS.map((kind) => [
        kind,
        { local: local.has(kind), available: !!available[kind] },
      ]),
    ) as ScrapePreview['art'];
    const fields = Object.fromEntries(
      SCRAPE_FIELDS.map((field) => [
        field,
        {
          current: currentValue(game, field),
          scraped: scraped[field],
          locked: game.lockedFields.includes(field),
        },
      ]),
    ) as ScrapePreview['fields'];
    return { art, fields };
  }

  private scrapedValues(remote: SsGame, settings: Settings) {
    return {
      ...extractMetadata(remote, languages(settings)),
      title: gameName(remote, settings.scraper.regionPriority),
    } satisfies Record<ScrapeField, string | number | null>;
  }

  /** `opts` come from a batch: its candidate count and region order (FR-SCR-2). */
  async apply(input: ScrapeApplyInput, opts: ApplyOptions = {}): Promise<ScrapeApplyResult> {
    if (this.deps.blocked() || this.applying.has(input.gameId)) {
      fail('BUSY', { gameId: input.gameId });
    }
    this.applying.add(input.gameId);
    try {
      return await this.applyOnce(input, opts);
    } finally {
      this.applying.delete(input.gameId);
    }
  }

  private async applyOnce(input: ScrapeApplyInput, opts: ApplyOptions): Promise<ScrapeApplyResult> {
    const game = this.deps.games.get(input.gameId);
    const settings = this.deps.settings();
    const remote = await this.deps.client.game(
      input.providerGameId,
      this.screenscraperId(game.systemId),
    );
    const selected = selectMedia(remote, opts.regions ?? settings.scraper.regionPriority);
    const location = this.deps.games.location(game.id);
    const dir = mediaDir(location, settings, this.deps.system(game.systemId));
    const stem = romStem(game.relPath);
    const written: Array<{ kind: GameArtKind; file: WriteResult }> = [];
    const failed: ScrapeApplyResult['failed'] = [];
    for (const kind of input.kinds) {
      const item = selected[kind];
      const url = item ? text(item.url) : null;
      if (!item || !url) {
        failed.push({ kind, code: 'notAvailable' });
        continue;
      }
      let download: Awaited<ReturnType<ScrapeServiceDeps['client']['download']>>;
      try {
        download = await this.deps.client.download(url);
        const usable = kind === 'video' ? download.bytes.length > 0 : isImage(download.bytes);
        if (!usable) throw new Error('not media');
      } catch (error) {
        if (opts.batch && error instanceof AppErrorException && TRANSPORT.has(error.error.code)) {
          throw error;
        }
        failed.push({ kind, code: 'download' });
        continue;
      }
      try {
        if (!dir) throw new Error('no media folder');
        const format = formatOf(item, download.contentType);
        written.push({
          kind,
          file: await this.deps.writer.write(dir, kind, stem, download.bytes, format),
        });
      } catch {
        failed.push({ kind, code: 'write' });
      }
    }
    const scraped = this.scrapedValues(remote, settings);
    const values = Object.fromEntries(input.fields.map((field) => [field, scraped[field]]));
    const now = this.deps.clock();
    this.deps.transaction(() => {
      for (const { kind, file } of written) {
        const { replaced, ...row } = file;
        this.deps.media.repoint(replaced, row);
        this.deps.media.upsert({ gameId: game.id, kind, ...row });
      }
      // Every ticked field is on purpose, so a locked one is written too (D19).
      this.deps.games.applyScraped(game.id, values, { overrideLocked: input.fields }, now);
      const savedNothing =
        written.length === 0 && failed.length > 0 && !Object.values(values).some((v) => v !== null);
      this.deps.scrapes.set(game.id, {
        status: savedNothing ? 'failed' : 'scraped',
        providerGameId: input.providerGameId,
        candidates: opts.candidates ?? 1,
        error: savedNothing ? (failed[0]?.code ?? null) : null,
        scrapedAt: now.toISOString(),
      });
    });
    this.deps.emit('library.changed', { systems: [game.systemId], gameIds: [game.id] });
    return { written: written.map((w) => w.kind), failed, game: this.deps.games.get(game.id) };
  }

  /** A listed candidate's box image; null for an unknown id, a failed download or a non-image. */
  async thumbnail(providerGameId: number): Promise<{ bytes: Buffer; mime: string } | null> {
    const url = this.thumbs.get(providerGameId);
    if (!url) return null;
    try {
      const file = await this.deps.client.download(url);
      // The upstream header is not trusted: the protocol serves only what the bytes say.
      const mime = imageType(file.bytes);
      return mime ? { bytes: file.bytes, mime } : null;
    } catch {
      return null;
    }
  }
}
