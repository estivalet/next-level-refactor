import type { GameDetails, ScrapeCandidate, ScraperSystem, ScrapePreview } from '@nextlevel/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorCode, errorMessageKey } from '../settings/settingsApi.ts';
import { previewScrape, scraperSystems, searchScrape, setScraperSystem } from './scrapeApi.ts';

export type ScrapePhase = 'searching' | 'results' | 'needsSystem' | 'error';

export interface ScrapeState {
  phase: ScrapePhase;
  /** i18n key of the last error, or null. */
  errorKey: string | null;
  candidates: ScrapeCandidate[];
  method: 'hash' | 'title' | null;
  selectedId: number | null;
  preview: ScrapePreview | null;
  previewLoading: boolean;
  systems: ScraperSystem[];
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
};

const best = (candidates: readonly ScrapeCandidate[]) =>
  candidates.reduce<ScrapeCandidate | null>(
    (top, c) => (!top || c.similarity > top.similarity ? c : top),
    null,
  );

/**
 * The Scrape… dialog's requests (US-C5): search on open, preview the selected candidate, the
 * system picker on NO_SCRAPER_SYSTEM. Every answer carries a sequence number; answers to an
 * older request, or arriving after the dialog closed, are dropped.
 */
export function useScrape(game: GameDetails) {
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
        const result = await previewScrape(game.id, providerGameId);
        if (seq === previewSeq.current) patch({ preview: result, previewLoading: false });
      } catch (error) {
        if (seq === previewSeq.current) {
          patch({ previewLoading: false, errorKey: errorMessageKey(error) });
        }
      }
    },
    [game.id, patch],
  );

  const loadSystems = useCallback(
    async (refresh: boolean) => {
      try {
        patch({ systems: await scraperSystems(refresh) });
      } catch (error) {
        patch({ errorKey: errorMessageKey(error) });
      }
    },
    [patch],
  );

  const search = useCallback(
    async (title?: string) => {
      const seq = ++searchSeq.current;
      ++previewSeq.current;
      patch({ ...INITIAL, systems: [] });
      try {
        const result = await searchScrape(
          title === undefined ? { gameId: game.id } : { gameId: game.id, title, refresh: true },
        );
        if (seq !== searchSeq.current || !alive.current) return;
        const top = best(result.candidates);
        patch({ phase: 'results', candidates: result.candidates, method: result.method });
        if (top) void preview(top.providerGameId);
      } catch (error) {
        if (seq !== searchSeq.current) return;
        if (errorCode(error) === 'NO_SCRAPER_SYSTEM') {
          patch({ phase: 'needsSystem' });
          await loadSystems(false);
        } else {
          patch({ phase: 'error', errorKey: errorMessageKey(error) });
        }
      }
    },
    [game.id, patch, preview, loadSystems],
  );

  const saveSystem = useCallback(
    async (screenscraperId: number) => {
      try {
        await setScraperSystem(game.systemId, screenscraperId);
        await search();
      } catch (error) {
        patch({ errorKey: errorMessageKey(error) });
      }
    },
    [game.systemId, patch, search],
  );

  useEffect(() => {
    void search();
  }, [search]);

  return { state, search, preview, saveSystem, reloadSystems: () => loadSystems(true) };
}
