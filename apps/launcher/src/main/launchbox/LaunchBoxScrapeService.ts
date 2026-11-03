import {
  AppErrorException,
  ERROR_CODES,
  GAME_ART_KINDS,
  launchboxThumbUrl,
  SCRAPE_FIELDS,
  type ScrapeApplyInput,
  type ScrapeApplyResult,
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
import type { MediaWriter } from '../scraper/MediaWriter.ts';
import { mediaDir } from '../scraper/mediaTarget.ts';
import { imageType } from '../scraper/sniff.ts';
import { writeScrape } from '../scraper/writeScrape.ts';
import type { LaunchBoxIndex } from './LaunchBoxIndex.ts';
import type { LaunchBoxService } from './LaunchBoxService.ts';
import { lbValues, selectArt } from './mapping.ts';
import { matchGames } from './match.ts';
import type { LbImage } from './parseMetadata.ts';

export const LAUNCHBOX_IMAGES_URL = 'https://images.launchbox-app.com/';

/** At most two image downloads a second (be polite to LaunchBox). */
const IMAGE_GAP_MS = 500;
/** Candidates past this many get no thumbnail (each is an image download), like ScreenScraper. */
const THUMBS_PER_SEARCH = 8;

export interface LaunchBoxScrapeDeps {
  launchbox: {
    index: () => Pick<LaunchBoxIndex, 'platformNames' | 'game' | 'images'>;
    platformOf: LaunchBoxService['platformOf'];
  };
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  /** Milliseconds, for the gap between image downloads. */
  now: () => number;
  games: Pick<GameRepository, 'get' | 'applyScraped' | 'location'>;
  media: Pick<MediaRepository, 'kindsByGame' | 'upsert' | 'repoint'>;
  scrapes: Pick<ScrapeRepository, 'set'>;
  writer: Pick<MediaWriter, 'write'>;
  transaction: (fn: () => void) => void;
  settings: () => Settings;
  system: (
    systemId: string,
  ) => { defaultFolderName: string; scraper: { screenscraperId?: number | undefined } } | undefined;
  emit: EmitEvent;
  clock: () => Date;
  /** A scan or import is running: its index write would undo an apply's rows. */
  blocked: () => boolean;
  /** e2e only: a fake images server. */
  imagesUrl?: string;
}

const extension = (fileName: string): string =>
  /\.([a-z0-9]+)$/i.exec(fileName)?.[1]?.toLowerCase() ?? 'png';

/**
 * Single-game scrape from the local LaunchBox index (FR-SCR-6): the same search / preview /
 * apply / thumbnail shape as ScrapeService, matched by title on the system's LaunchBox
 * platform, art downloaded from images.launchbox-app.com.
 */
export class LaunchBoxScrapeService {
  private readonly applying = new Set<number>();
  private lastDownload = Number.NEGATIVE_INFINITY;

  constructor(private readonly deps: LaunchBoxScrapeDeps) {}

  search(input: ScrapeSearchInput): Promise<ScrapeSearchResult> {
    return Promise.resolve().then(() => {
      const game = this.deps.games.get(input.gameId);
      const index = this.deps.launchbox.index();
      const names = index.platformNames(this.deps.launchbox.platformOf(game.systemId));
      const regions = this.deps.settings().scraper.regionPriority;
      const matches = matchGames(names, {
        title: input.title ?? game.title,
        fileName: game.relPath.split('/').pop() ?? game.relPath,
      });
      return {
        method: 'title' as const,
        candidates: matches.map((match, position) => {
          const year = index.game(match.id)?.year ?? null;
          const box = selectArt(index.images(match.id), regions)['box-front'];
          return {
            providerGameId: match.id,
            name: match.name,
            year: year === null ? null : String(year),
            region: null,
            similarity: match.similarity,
            thumb: box && position < THUMBS_PER_SEARCH ? launchboxThumbUrl(match.id) : null,
          };
        }),
      };
    });
  }

  private remote(providerGameId: number) {
    const index = this.deps.launchbox.index();
    const game = index.game(providerGameId);
    if (!game) throw new AppErrorException({ code: 'NOT_FOUND', message: ERROR_CODES.NOT_FOUND });
    return { game, images: index.images(providerGameId) };
  }

  preview(input: ScrapePreviewInput): Promise<ScrapePreview> {
    return Promise.resolve().then(() => {
      const game = this.deps.games.get(input.gameId);
      const remote = this.remote(input.providerGameId);
      const available = selectArt(remote.images, this.deps.settings().scraper.regionPriority);
      const local = new Set(this.deps.media.kindsByGame([game.id]).get(game.id) ?? []);
      const scraped = lbValues(remote.game);
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
            current: game[field],
            scraped: scraped[field],
            locked: game.lockedFields.includes(field),
          },
        ]),
      ) as ScrapePreview['fields'];
      return { art, fields };
    });
  }

  async apply(
    input: ScrapeApplyInput,
    opts: { candidates?: number; regions?: readonly string[]; batch?: boolean } = {},
  ): Promise<ScrapeApplyResult> {
    if (this.deps.blocked() || this.applying.has(input.gameId)) {
      throw new AppErrorException({
        code: 'BUSY',
        message: ERROR_CODES.BUSY,
        details: { gameId: input.gameId },
      });
    }
    this.applying.add(input.gameId);
    try {
      const game = this.deps.games.get(input.gameId);
      const settings = this.deps.settings();
      const remote = this.remote(input.providerGameId);
      const selected = selectArt(remote.images, opts.regions ?? settings.scraper.regionPriority);
      const scraped = lbValues(remote.game);
      return await writeScrape(
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
          provider: 'launchbox',
          providerGameId: input.providerGameId,
          kinds: input.kinds,
          fetchArt: async (kind) => {
            const image = selected[kind];
            if (!image) return null;
            return { bytes: await this.download(image), format: extension(image.fileName) };
          },
          values: Object.fromEntries(input.fields.map((field) => [field, scraped[field]])),
          overrideLocked: input.fields,
          candidates: opts.candidates ?? 1,
          batch: opts.batch ?? false,
        },
      );
    } finally {
      this.applying.delete(input.gameId);
    }
  }

  /** One image, at most two a second; a lost connection is SCRAPER_NETWORK (a batch pauses). */
  private async download(image: LbImage): Promise<Buffer> {
    // Each download reserves its slot before waiting, so simultaneous requests (a candidate
    // list's thumbnails) still go out 500 ms apart.
    const now = this.deps.now();
    const slot = Math.max(now, this.lastDownload + IMAGE_GAP_MS);
    this.lastDownload = slot;
    if (slot > now) await this.deps.sleep(slot - now);
    let response: Response;
    try {
      response = await this.deps.fetch(
        `${this.deps.imagesUrl ?? LAUNCHBOX_IMAGES_URL}${encodeURIComponent(image.fileName)}`,
      );
    } catch {
      throw new AppErrorException({
        code: 'SCRAPER_NETWORK',
        message: ERROR_CODES.SCRAPER_NETWORK,
      });
    }
    if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
    return Buffer.from(await response.arrayBuffer());
  }

  /** A candidate's box image; null for an unknown id, a failed download or a non-image. */
  async thumbnail(databaseId: number): Promise<{ bytes: Buffer; mime: string } | null> {
    try {
      const { images } = this.remote(databaseId);
      const box = selectArt(images, this.deps.settings().scraper.regionPriority)['box-front'];
      if (!box) return null;
      const bytes = await this.download(box);
      const mime = imageType(bytes);
      return mime ? { bytes, mime } : null;
    } catch {
      return null;
    }
  }
}
