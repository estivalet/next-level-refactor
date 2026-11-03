import type {
  GameDetails,
  ScrapeCandidate,
  ScrapePreview,
  ScrapeProvider,
} from '@nextlevel/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorCode, errorMessageKey } from '../settings/settingsApi.ts';
import { useIpcEvent } from '../../events.ts';
import {
  launchboxPlatforms,
  previewScrape,
  providerInput,
  refreshLaunchBox,
  scraperSystems,
  searchScrape,
  setLaunchBoxPlatform,
  setScraperSystem,
} from './scrapeApi.ts';
import type { PickerOption } from './SystemPicker.tsx';

/** `needsDownload`: the LaunchBox database isn't downloaded yet (FR-SCR-6). */
export type ScrapePhase = 'searching' | 'results' | 'needsSystem' | 'needsDownload' | 'error';

export interface ScrapeState {
  phase: ScrapePhase;
  /** i18n key of the last error, or null. */
  errorKey: string | null;
  candidates: ScrapeCandidate[];
  method: 'hash' | 'title' | null;
  selectedId: number | null;
  preview: ScrapePreview | null;
  previewLoading: boolean;
  /** The picker's choices: ScreenScraper systems or LaunchBox platforms. */
  systems: PickerOption[];
  /** The LaunchBox download was started from the dialog. */
  downloading: boolean;
}

const INITIAL: ScrapeState = {
  phase: 'searching',
  errorKey: null,
  candidates: [],
  method: null,
  selectedId: null,
  preview: null,
  previewLoading: false,
  systems: [],
  downloading: false,
};

const best = (candidates: readonly ScrapeCandidate[]) =>
  candidates.reduce<ScrapeCandidate | null>(
    (top, c) => (!top || c.similarity > top.similarity ? c : top),
    null,
  );

/**
 * The Scrape… dialog's requests (US-C5): search on open, preview the selected candidate, the
 * system picker on NO_SCRAPER_SYSTEM / NO_LAUNCHBOX_PLATFORM, the download offer on
 * LAUNCHBOX_INDEX_MISSING (FR-SCR-6). Every answer carries a sequence number; answers to an
 * older request, or arriving after the dialog closed, are dropped.
 */
export function useScrape(game: GameDetails, provider: ScrapeProvider = 'screenscraper') {
  const [state, setState] = useState<ScrapeState>(INITIAL);
  const searchSeq = useRef(0);
  const previewSeq = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const patch = useCallback((change: Partial<ScrapeState>) => {
    if (alive.current) setState((current) => ({ ...current, ...change }));
  }, []);

  const preview = useCallback(
    async (providerGameId: number) => {
      const seq = ++previewSeq.current;
      patch({ selectedId: providerGameId, preview: null, previewLoading: true, errorKey: null });
      try {
        const result = await previewScrape(game.id, providerGameId, provider);
        if (seq === previewSeq.current) patch({ preview: result, previewLoading: false });
      } catch (error) {
        if (seq === previewSeq.current) {
          patch({ previewLoading: false, errorKey: errorMessageKey(error) });
        }
      }
    },
    [game.id, patch, provider],
  );

  const loadSystems = useCallback(
    async (refresh: boolean) => {
      try {
        patch({
          systems:
            provider === 'launchbox'
              ? (await launchboxPlatforms()).map((name) => ({ value: name, label: name }))
              : (await scraperSystems(refresh)).map((system) => ({
                  value: String(system.id),
                  label: system.name,
                })),
        });
      } catch (error) {
        patch({ errorKey: errorMessageKey(error) });
      }
    },
    [patch, provider],
  );

  const search = useCallback(
    async (title?: string) => {
      const seq = ++searchSeq.current;
      ++previewSeq.current;
      patch({ ...INITIAL, systems: [] });
      try {
        const result = await searchScrape({
          gameId: game.id,
          ...(title === undefined ? {} : { title, refresh: true }),
          ...providerInput(provider),
        });
        if (seq !== searchSeq.current || !alive.current) return;
        const top = best(result.candidates);
        patch({ phase: 'results', candidates: result.candidates, method: result.method });
        if (top) void preview(top.providerGameId);
      } catch (error) {
        if (seq !== searchSeq.current) return;
        const code = errorCode(error);
        if (code === 'NO_SCRAPER_SYSTEM' || code === 'NO_LAUNCHBOX_PLATFORM') {
          patch({ phase: 'needsSystem' });
          await loadSystems(false);
        } else if (code === 'LAUNCHBOX_INDEX_MISSING') {
          patch({ phase: 'needsDownload' });
        } else {
          patch({ phase: 'error', errorKey: errorMessageKey(error) });
        }
      }
    },
    [game.id, patch, preview, loadSystems, provider],
  );

  const saveSystem = useCallback(
    async (value: string) => {
      try {
        if (provider === 'launchbox') await setLaunchBoxPlatform(game.systemId, value);
        else await setScraperSystem(game.systemId, Number(value));
        await search();
      } catch (error) {
        patch({ errorKey: errorMessageKey(error) });
      }
    },
    [game.systemId, patch, search, provider],
  );

  useEffect(() => {
    void search();
  }, [search]);

  // The database finished downloading while the dialog waited for it: search now.
  const waiting = state.phase === 'needsDownload';
  useIpcEvent('launchbox.changed', (status) => {
    if (provider === 'launchbox' && waiting && status.state === 'ready') void search();
  });
  const download = async () => {
    try {
      patch({ downloading: true, errorKey: null });
      await refreshLaunchBox();
    } catch (error) {
      patch({ downloading: false, errorKey: errorMessageKey(error) });
    }
  };

  return {
    state,
    search,
    preview,
    saveSystem,
    download,
    reloadSystems: () => loadSystems(true),
  };
}
