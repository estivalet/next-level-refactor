import {
  err,
  ok,
  type IpcInput,
  type Result,
  type ScrapeApplyResult,
  type ScrapeSearchResult,
} from '@nextlevel/shared';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell, type FakeResponses } from '../../test-utils.tsx';
import { gameDetails, gameRow } from '../library/testing.ts';
import { ScrapeDialog } from './ScrapeDialog.tsx';
import { candidate, SAMPLE_PREVIEW } from './testing.ts';

afterEach(() => {
  setBridgeForTests(null);
});

const GAME = gameDetails(gameRow(7, 'Racer'));
const FOUND: ScrapeSearchResult = {
  method: 'title',
  candidates: [candidate(500, 'Zoom Racer', 82.5), candidate(501, 'Zoom Racer II', 91)],
};
const APPLIED: ScrapeApplyResult = { written: ['logo-clear'], failed: [], game: GAME };

function setup(responses: FakeResponses = {}, provider?: 'screenscraper' | 'launchbox') {
  const fake = installFakeBridge({
    'library.games.get': () => ok(GAME),
    'scraper.search': () => ok(FOUND),
    'scraper.preview': () => ok(SAMPLE_PREVIEW),
    'scraper.apply': () => ok(APPLIED),
    ...responses,
  });
  let closed = 0;
  const view = renderInShell(
    <div className="relative">
      <ScrapeDialog
        gameId={7}
        {...(provider ? { provider } : {})}
        onClose={() => {
          closed += 1;
        }}
      />
    </div>,
  );
  const inputs = <C extends 'scraper.search' | 'scraper.apply' | 'scraper.preview'>(channel: C) =>
    fake.calls.filter((call) => call.channel === channel).map((call) => call.input as IpcInput<C>);
  return { fake, view, inputs, closed: () => closed };
}

describe('ScrapeDialog (FR-SCR-1, US-C5)', () => {
  it('US-C5: searching on open, best candidate preselected, preview rows default to missing art and empty fields', async () => {
    const { inputs } = setup();
    const dialog = await screen.findByRole('dialog', { name: 'Scrape: Racer' });
    const best = await within(dialog).findByRole('radio', { name: /Zoom Racer II/ });
    expect(best).toBeChecked();
    expect(inputs('scraper.search')).toEqual([{ gameId: 7 }]);
    await waitFor(() => {
      expect(inputs('scraper.preview')).toEqual([{ gameId: 7, providerGameId: 501 }]);
    });
    expect(await within(dialog).findByRole('checkbox', { name: 'Clear logo' })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'Box front' })).not.toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'Title' })).not.toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'Year' })).toBeChecked();
  });

  it('Overwrite ticks filled rows but not locked ones (D19); a ticked locked field is sent', async () => {
    const user = userEvent.setup();
    const { inputs, closed } = setup();
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('checkbox', { name: 'Clear logo' });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Overwrite existing' }));
    expect(within(dialog).getByRole('checkbox', { name: 'Box front' })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'Developer' })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'Genre' })).not.toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'Title' })).not.toBeChecked();
    await user.click(within(dialog).getByRole('checkbox', { name: 'Genre' }));
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));
    await waitFor(() => {
      expect(closed()).toBe(1);
    });
    expect(inputs('scraper.apply')).toEqual([
      {
        gameId: 7,
        providerGameId: 501,
        kinds: ['box-front', 'video', 'logo-clear'],
        fields: ['year', 'developer', 'genre'],
      },
    ]);
  });

  it('the search box searches again by title, skipping the cache', async () => {
    const user = userEvent.setup();
    const { inputs } = setup();
    const dialog = await screen.findByRole('dialog');
    const box = within(dialog).getByRole('textbox', { name: 'Search title' });
    await user.clear(box);
    await user.type(box, 'Zoom{Enter}');
    await waitFor(() => {
      expect(inputs('scraper.search')).toEqual([
        { gameId: 7 },
        { gameId: 7, title: 'Zoom', refresh: true },
      ]);
    });
  });

  it('NO_SCRAPER_SYSTEM shows the system picker; saving the system searches again', async () => {
    const user = userEvent.setup();
    let mapped = false;
    const { fake, inputs } = setup({
      'scraper.search': () =>
        mapped ? ok(FOUND) : err('NO_SCRAPER_SYSTEM', 'errors.noScraperSystem'),
      'scraper.systems': () => ok([{ id: 4, name: 'Alpha Console' }]),
      'scraper.setSystemId': () => {
        mapped = true;
        return ok(undefined);
      },
    });
    const dialog = await screen.findByRole('dialog');
    const picker = await within(dialog).findByRole('combobox', { name: 'ScreenScraper system' });
    await user.selectOptions(picker, '4');
    await user.click(within(dialog).getByRole('button', { name: 'Save system' }));
    expect(await within(dialog).findByRole('radio', { name: /Zoom Racer II/ })).toBeChecked();
    expect(fake.calls.find((call) => call.channel === 'scraper.setSystemId')?.input).toEqual({
      systemId: 'nintendo-64',
      screenscraperId: 4,
    });
    expect(inputs('scraper.search')).toHaveLength(2);
  });

  it('a partial failure lists the failed kinds and keeps the dialog open', async () => {
    const user = userEvent.setup();
    const { closed } = setup({
      'scraper.apply': () => ok({ ...APPLIED, failed: [{ kind: 'video', code: 'write' }] }),
    });
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('checkbox', { name: 'Clear logo' });
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Video');
    expect(alert).toHaveTextContent(/could not be saved/i);
    expect(closed()).toBe(0);
  });

  it('a search error is shown translated', async () => {
    setup({ 'scraper.search': () => err('SCRAPER_QUOTA', 'errors.scraperQuota') });
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/quota/i);
  });

  it('Esc closes; late results after close are ignored', async () => {
    const user = userEvent.setup();
    let release: (value: Result<ScrapeSearchResult>) => void = () => undefined;
    const { inputs, closed, view } = setup({
      'scraper.search': () =>
        new Promise<Result<ScrapeSearchResult>>((resolve) => {
          release = resolve;
        }),
    });
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    expect(closed()).toBe(1);
    view.unmount();
    await act(async () => {
      release(ok(FOUND));
      await Promise.resolve();
    });
    expect(inputs('scraper.preview')).toEqual([]);
  });

  it('FR-SCR-6: Scrape from LaunchBox searches, previews and applies with provider launchbox', async () => {
    const user = userEvent.setup();
    const { inputs } = setup({}, 'launchbox');
    const dialog = await screen.findByRole('dialog', { name: 'Scrape from LaunchBox: Racer' });
    await within(dialog).findByRole('checkbox', { name: 'Clear logo' });
    expect(inputs('scraper.search')).toEqual([{ gameId: 7, provider: 'launchbox' }]);
    expect(inputs('scraper.preview')).toEqual([
      { gameId: 7, providerGameId: 501, provider: 'launchbox' },
    ]);
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));
    expect(inputs('scraper.apply')[0]).toMatchObject({ provider: 'launchbox' });
  });

  it('FR-SCR-6: no ScreenScraper match offers Try LaunchBox in the same dialog', async () => {
    const user = userEvent.setup();
    const { inputs } = setup({
      'scraper.search': (input) =>
        ok(
          (input as { provider?: string }).provider === 'launchbox'
            ? FOUND
            : { method: 'title', candidates: [] },
        ),
    });
    const dialog = await screen.findByRole('dialog', { name: 'Scrape: Racer' });
    await user.click(await within(dialog).findByRole('button', { name: 'Try LaunchBox' }));
    expect(
      await screen.findByRole('dialog', { name: 'Scrape from LaunchBox: Racer' }),
    ).toBeVisible();
    await waitFor(() => {
      expect(inputs('scraper.search').at(-1)).toEqual({ gameId: 7, provider: 'launchbox' });
    });
  });

  it('FR-SCR-6: without the LaunchBox database the dialog offers the download, then searches', async () => {
    const user = userEvent.setup();
    let ready = false;
    const { fake, inputs } = setup(
      {
        'scraper.search': () =>
          ready ? ok(FOUND) : err('LAUNCHBOX_INDEX_MISSING', 'errors.launchboxIndexMissing'),
        'launchbox.refresh': () =>
          ok({ state: 'downloading', builtAt: null, games: 0, progress: 0, error: null }),
      },
      'launchbox',
    );
    const dialog = await screen.findByRole('dialog');
    expect(
      await within(dialog).findByText('Download the LaunchBox database (about 110 MB)?'),
    ).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Download' }));
    expect(fake.calls.some((call) => call.channel === 'launchbox.refresh')).toBe(true);
    ready = true;
    act(() => {
      fake.emit('launchbox.changed', {
        state: 'ready',
        builtAt: '2026-11-02T08:00:00.000Z',
        games: 3,
        progress: null,
        error: null,
      });
    });
    expect(await within(dialog).findByRole('radio', { name: /Zoom Racer II/ })).toBeChecked();
    expect(inputs('scraper.search')).toHaveLength(2);
  });

  it('FR-SCR-6: a system without a LaunchBox platform shows the platform picker', async () => {
    const user = userEvent.setup();
    let mapped = false;
    const { fake, inputs } = setup(
      {
        'scraper.search': () =>
          mapped ? ok(FOUND) : err('NO_LAUNCHBOX_PLATFORM', 'errors.noLaunchboxPlatform'),
        'launchbox.platforms': () => ok(['Microsoft Xbox 360', 'Nintendo 64']),
        'launchbox.setPlatform': () => {
          mapped = true;
          return ok(undefined);
        },
      },
      'launchbox',
    );
    const dialog = await screen.findByRole('dialog');
    const picker = await within(dialog).findByRole('combobox', { name: 'LaunchBox platform' });
    await user.selectOptions(picker, 'Nintendo 64');
    await user.click(within(dialog).getByRole('button', { name: 'Save platform' }));
    expect(await within(dialog).findByRole('radio', { name: /Zoom Racer II/ })).toBeChecked();
    expect(fake.calls.find((call) => call.channel === 'launchbox.setPlatform')?.input).toEqual({
      systemId: 'nintendo-64',
      platform: 'Nintendo 64',
    });
    expect(inputs('scraper.search')).toHaveLength(2);
  });
});
