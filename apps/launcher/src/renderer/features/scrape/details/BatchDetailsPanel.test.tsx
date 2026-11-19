import {
  IDLE_BATCH,
  ok,
  type BatchItemsInput,
  type BatchJobDetails,
  type BatchJobItem,
  type BatchStatus,
} from '@nextlevel/shared';
import { getSystem, systemCatalog } from '@nextlevel/system-catalog';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../../test-utils.tsx';
import { BatchDetailsPanel } from './BatchDetailsPanel.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

const SNES = getSystem('nintendo-snes')?.name ?? '';
const RUNNING: BatchStatus = {
  ...IDLE_BATCH,
  jobId: 7,
  state: 'running',
  total: 753,
  done: 24,
  applied: 15,
  review: 6,
  notFound: 2,
  failed: 0,
  launchbox: 9,
  current: { gameId: 99, title: 'Zoom Racer' },
  systemIds: ['nintendo-snes'],
  startedAt: '2026-11-17T21:04:00.000Z',
  resumedAt: null,
};
const DETAILS: BatchJobDetails = {
  status: RUNNING,
  scope: { systemIds: ['nintendo-snes'] },
  rules: {
    onlyMissing: true,
    kinds: ['box-front', 'screenshot-game-play'],
    fields: ['genre'],
    regions: ['us', 'eu'],
    launchbox: true,
  },
  startedAt: RUNNING.startedAt ?? '',
  listed: 24,
};
const item = (gameId: number, title: string, extra: Partial<BatchJobItem> = {}): BatchJobItem => ({
  gameId,
  title,
  systemId: 'nintendo-snes',
  outcome: 'applied',
  provider: 'screenscraper',
  error: null,
  handledAt: `2026-11-19T10:${String(gameId).padStart(2, '0')}:00.000Z`,
  ...extra,
});
const ITEMS = [
  item(3, 'Gamma', { outcome: 'failed', error: 'NOT_FOUND' }),
  item(2, 'Beta', { outcome: 'review', provider: 'launchbox' }),
  item(1, 'Alpha'),
];

function setup(details: BatchJobDetails = DETAILS, status: BatchStatus = RUNNING) {
  const asked: BatchItemsInput[] = [];
  const opened: Array<{ gameId: number; title: string }> = [];
  const review: Array<string[] | null> = [];
  let closed = 0;
  const fake = installFakeBridge({
    'systems.catalog': () => ok([...systemCatalog()]),
    'scraper.batch.status': () => ok(status),
    'scraper.batch.pause': () => ok(status),
    'scraper.batch.details': () => ok(details),
    'scraper.batch.items': (input) => {
      asked.push(input);
      const items = input.outcome ? ITEMS.filter((i) => i.outcome === input.outcome) : ITEMS;
      return ok({ items, next: null });
    },
  });
  renderInShell(
    <BatchDetailsPanel
      onClose={() => {
        closed += 1;
      }}
      onOpenGame={(game) => opened.push(game)}
      onShowReview={(systemIds) => review.push(systemIds)}
    />,
  );
  return { fake, asked, opened, review, closed: () => closed };
}

const panel = () => screen.findByRole('dialog', { name: `Scrape · ${SNES}` });

describe('BatchDetailsPanel (FR-SCR-8, US-C8)', () => {
  it('US-C8: shows scope, start time, counts including Nothing to fill, and the current game', async () => {
    setup();
    const dialog = await panel();
    expect(within(dialog).getByText(/^Running · started /)).toBeVisible();
    expect(
      await within(dialog).findByText(
        'Applied 15 (9 LaunchBox) · Review 6 · Not found 2 · Failed 0 · Nothing to fill 1',
      ),
    ).toBeVisible();
    expect(within(dialog).getByText('Now: Zoom Racer')).toBeVisible();
    expect(within(dialog).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '24');
  });

  it('US-C8: lists handled games newest first with outcome and source', async () => {
    setup();
    const list = await screen.findByRole('list', { name: 'Games this scrape handled' });
    const rows = await within(list).findAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringMatching(/^Gamma.*Failed/),
      expect.stringMatching(/^Beta.*Review.*LaunchBox/),
      expect.stringMatching(/^Alpha.*Applied.*ScreenScraper/),
    ]);
  });

  it('US-C8: the Failed chip asks items with outcome failed and shows the error', async () => {
    const user = userEvent.setup();
    const { asked } = setup();
    await user.click(await screen.findByRole('button', { name: 'Failed', pressed: false }));
    await waitFor(() => {
      expect(asked.at(-1)).toMatchObject({ outcome: 'failed' });
    });
    const list = screen.getByRole('list', { name: 'Games this scrape handled' });
    await waitFor(() => {
      expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    });
    expect(within(list).getByText('That item no longer exists.')).toBeVisible();
  });

  it('US-C8: a job older than this update says earlier games are not listed', async () => {
    setup({ ...DETAILS, listed: 0 });
    expect(
      await screen.findByText("Games handled before this update aren't listed."),
    ).toBeVisible();
  });

  it('US-C8: rules summary lists art kinds, fields, regions and then LaunchBox', async () => {
    setup();
    const dialog = await panel();
    const rules = await within(dialog).findByText('Rules');
    const summary = rules.closest('details');
    expect(summary).toHaveTextContent('Only missing art and fields');
    expect(summary).toHaveTextContent('Box front');
    expect(summary).toHaveTextContent('Genre');
    expect(summary).toHaveTextContent('US, EU');
    expect(summary).toHaveTextContent('Then fill from LaunchBox');
  });

  it('US-C8: Esc closes; clicking a game opens it and closes', async () => {
    const user = userEvent.setup();
    const { opened, closed } = setup();
    await user.click(await screen.findByRole('button', { name: /^Alpha/ }));
    expect(opened).toEqual([{ gameId: 1, title: 'Alpha' }]);
    expect(closed()).toBe(1);
    await user.keyboard('{Escape}');
    expect(closed()).toBe(2);
  });

  it('US-C8: Pause in the panel pauses the job; Show Needs review opens the review', async () => {
    const user = userEvent.setup();
    const { fake, review } = setup();
    const dialog = await panel();
    await user.click(within(dialog).getByRole('button', { name: 'Pause' }));
    expect(fake.channels().filter((c) => c === 'scraper.batch.pause')).toHaveLength(1);
    await user.click(within(dialog).getByRole('button', { name: 'Show Needs review' }));
    expect(review).toEqual([['nintendo-snes']]);
  });
});
