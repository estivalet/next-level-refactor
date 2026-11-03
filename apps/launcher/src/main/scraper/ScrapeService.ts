import {
  AppErrorException,
  ERROR_CODES,
  GAME_ART_KINDS,
  SCRAPE_FIELDS,
  scrapeThumbUrl,
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
import { mediaDir } from './mediaTarget.ts';
import { writeScrape } from './writeScrape.ts';
import { imageType } from './sniff.ts';
import type { MediaWriter } from './MediaWriter.ts';
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
    const scraped = this.scrapedValues(remote, settings);
    return writeScrape(
      {
        ...this.deps,
        mediaDir: (target) =>
          mediaDir(
            this.deps.games.location(target.id),
            settings,
            this.deps.system(target.systemId),
          ),
      },
      {
        game,
        provider: 'screenscraper',
        providerGameId: input.providerGameId,
        kinds: input.kinds,
        fetchArt: async (kind) => {
          const item = selected[kind];
          const url = item ? text(item.url) : null;
          if (!item || !url) return null;
          const download = await this.deps.client.download(url);
          return { bytes: download.bytes, format: formatOf(item, download.contentType) };
        },
        values: Object.fromEntries(input.fields.map((field) => [field, scraped[field]])),
        // Every ticked field is on purpose, so a locked one is written too (D19).
        overrideLocked: input.fields,
        candidates: opts.candidates ?? 1,
        batch: opts.batch ?? false,
      },
    );
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
