import type { IpcHandlers } from '../../ipc/router.ts';
import type { BatchScrapeService } from './BatchScrapeService.ts';

type BatchChannel = Extract<keyof IpcHandlers, `scraper.batch.${string}`>;

/** Batch scrape channels (FR-SCR-2, US-C6); progress also arrives as `scraper.batch.progress`. */
export function createBatchHandlers(deps: {
  batch: () => Pick<BatchScrapeService, 'begin' | 'pause' | 'resume' | 'cancel' | 'status'>;
}): Pick<IpcHandlers, BatchChannel> {
  return {
    'scraper.batch.start': ({ scope, rules }) => deps.batch().begin(scope, rules),
    'scraper.batch.pause': () => deps.batch().pause(),
    'scraper.batch.resume': () => deps.batch().resume(),
    'scraper.batch.cancel': () => deps.batch().cancel(),
    'scraper.batch.status': () => deps.batch().status(),
  };
}
