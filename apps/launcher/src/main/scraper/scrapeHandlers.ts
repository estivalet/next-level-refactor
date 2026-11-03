import {
  AppErrorException,
  ERROR_CODES,
  SystemSettingsSchema,
  type ScrapeProvider,
  type ScraperSystem,
  type Settings,
} from '@nextlevel/shared';
import type { IpcHandlers } from '../ipc/router.ts';
import type { LaunchBoxScrapeService } from '../launchbox/LaunchBoxScrapeService.ts';
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
  /** FR-SCR-6: the same channels with `provider: 'launchbox'`. */
  launchbox: () => Pick<LaunchBoxScrapeService, 'search' | 'preview' | 'apply'>;
  systems: (opts: { refresh?: boolean | undefined }) => Promise<ScraperSystem[]>;
  /** A settings write (with its backup and `settings.changed`). */
  updateSettings: (change: (settings: Settings) => Settings) => Promise<void>;
  /** Whether the system catalog has this system id. */
  systemExists: (systemId: string) => boolean;
}): Pick<IpcHandlers, ScrapeChannel> {
  const source = (input: { provider?: ScrapeProvider | undefined }) =>
    input.provider === 'launchbox' ? deps.launchbox() : deps.service();
  return {
    'scraper.systems': (input) => deps.systems(input),
    'scraper.search': (input) => source(input).search(input),
    'scraper.preview': (input) => source(input).preview(input),
    'scraper.apply': (input) => source(input).apply(input),
    'scraper.setSystemId': ({ systemId, screenscraperId }) => {
      if (!deps.systemExists(systemId)) {
        return Promise.reject(
          new AppErrorException({ code: 'NOT_FOUND', message: ERROR_CODES.NOT_FOUND }),
        );
      }
      return deps.updateSettings((settings) => ({
        ...settings,
        systems: {
          ...settings.systems,
          [systemId]: {
            ...(settings.systems[systemId] ?? SystemSettingsSchema.parse({})),
            screenscraperId,
          },
        },
      }));
    },
  };
}
