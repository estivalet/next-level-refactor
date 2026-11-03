import type { ScrapeProvider } from '@nextlevel/shared';

/** Dialog texts that name the source; LaunchBox has its own under `library.scrape.lb` (FR-SCR-6). */
const LAUNCHBOX_TEXTS = new Set([
  'title',
  'searching',
  'notAvailable',
  'needsSystem',
  'systemLabel',
  'chooseSystem',
  'saveSystem',
  'noSystems',
  'failure.notAvailable',
]);

/** The i18n key of a scrape dialog text for this source. */
export function scrapeKey(provider: ScrapeProvider, name: string): string {
  return provider === 'launchbox' && LAUNCHBOX_TEXTS.has(name)
    ? `library.scrape.lb.${name}`
    : `library.scrape.${name}`;
}
