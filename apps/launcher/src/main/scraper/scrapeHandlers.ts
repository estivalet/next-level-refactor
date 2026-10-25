import { SystemSettingsSchema, type ScraperSystem, type Settings } from '@nextlevel/shared';
import type { IpcHandlers } from '../ipc/router.ts';
import type { ScrapeService } from './ScrapeService.ts';

type ScrapeChannel =
  | 'scraper.systems'
  | 'scraper.search'
  | 'scraper.preview'
  | 'scraper.apply'
  | 'scraper.setSystemId';

/** Single-game scrape channels (FR-SCR-1, US-C5). */
export function createScrapeHandlers(deps: {
  service: () => Pick<ScrapeService, 'search' | 'preview' | 'apply'>;
  systems: (opts: { refresh?: boolean | undefined }) => Promise<ScraperSystem[]>;
  /** A settings write (with its backup and `settings.changed`). */
  updateSettings: (change: (settings: Settings) => Settings) => Promise<void>;
}): Pick<IpcHandlers, ScrapeChannel> {
  return {
    'scraper.systems': (input) => deps.systems(input),
    'scraper.search': (input) => deps.service().search(input),
    'scraper.preview': (input) => deps.service().preview(input),
    'scraper.apply': (input) => deps.service().apply(input),
    'scraper.setSystemId': ({ systemId, screenscraperId }) =>
      deps.updateSettings((settings) => ({
        ...settings,
        systems: {
          ...settings.systems,
          [systemId]: {
            ...(settings.systems[systemId] ?? SystemSettingsSchema.parse({})),
            screenscraperId,
          },
        },
      })),
  };
}
