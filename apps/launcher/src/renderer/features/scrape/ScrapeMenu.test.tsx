import { IDLE_BATCH, ok, type BatchStatus } from '@nextlevel/shared';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { useShell } from '../shell/ShellContext.tsx';
import { ScrapeMenu } from './ScrapeMenu.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

/** Shows the shell's windows, so a test can see which app Open Settings opened. */
function WindowsProbe() {
  const { state } = useShell();
  return (
    <output aria-label="windows">
      {JSON.stringify(state.windows.map((w) => ({ appId: w.appId, params: w.params })))}
    </output>
  );
}

const RUNNING: BatchStatus = {
  ...IDLE_BATCH,
  jobId: 1,
  state: 'running',
  total: 10,
  done: 3,
  applied: 2,
  review: 1,
  current: { gameId: 4, title: 'Zoom Racer' },
};

function setup(status: BatchStatus = IDLE_BATCH, selectedIds: number[] = []) {
  const rules: unknown[] = [];
  let review = 0;
  const bridge = installFakeBridge({
    'scraper.batch.status': () => ok(status),
    'scraper.batch.pause': () => ok({ ...status, state: 'paused', pausedReason: 'user' }),
    'scraper.batch.resume': () => ok(RUNNING),
    'scraper.batch.cancel': () => ok({ ...status, state: 'finished' }),
  });
  renderInShell(
    <>
      <ScrapeMenu
        system={{ id: 'snes', name: 'Super Nintendo' }}
        selectedIds={selectedIds}
        onRules={(scope) => {
          rules.push(scope);
        }}
        onShowReview={() => {
          review += 1;
        }}
      />
      <WindowsProbe />
    </>,
  );
  return { bridge, rules, review: () => review };
}

const calls = (bridge: ReturnType<typeof installFakeBridge>, channel: string) =>
  bridge.calls.filter((c) => c.channel === channel).length;

describe('ScrapeMenu (FR-SCR-2, US-C6)', () => {
  it('US-C6: Scrape <system>… opens the rules for that system; a selection offers its games', async () => {
    const user = userEvent.setup();
    const { rules } = setup(IDLE_BATCH, [3, 5, 8]);
    await user.click(await screen.findByRole('button', { name: /^Scrape/ }));
    const menu = screen.getByRole('menu', { name: 'Scrape' });
    await user.click(within(menu).getByRole('menuitem', { name: 'Scrape Super Nintendo…' }));
    await user.click(screen.getByRole('button', { name: /^Scrape/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Scrape 3 selected games…' }));
    expect(rules).toEqual([{ systemIds: ['snes'] }, { gameIds: [3, 5, 8] }]);
  });

  it('the status is read on mount: a running job shows its progress with Pause and Cancel', async () => {
    const user = userEvent.setup();
    const { bridge } = setup(RUNNING);
    expect(await screen.findByText('Scraping 3/10 · applied 2 · review 1')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(calls(bridge, 'scraper.batch.pause')).toBe(1);
    await user.click(screen.getByRole('button', { name: 'Cancel scraping' }));
    expect(calls(bridge, 'scraper.batch.cancel')).toBe(1);
  });

  it('progress events from main update the line', async () => {
    const { bridge } = setup(RUNNING);
    await screen.findByText('Scraping 3/10 · applied 2 · review 1');
    act(() => {
      bridge.emit('scraper.batch.progress', { ...RUNNING, done: 4, applied: 3 });
    });
    expect(await screen.findByText('Scraping 4/10 · applied 3 · review 1')).toBeVisible();
  });

  it('a quota pause says when it resumes, with Resume', async () => {
    const user = userEvent.setup();
    const { bridge } = setup({
      ...RUNNING,
      state: 'paused',
      pausedReason: 'quota',
      resumeAt: '2026-10-25T22:00:00.000Z',
      current: null,
    });
    expect(await screen.findByText(/Daily quota reached — resumes at/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Resume' }));
    expect(calls(bridge, 'scraper.batch.resume')).toBe(1);
  });

  it('a credentials pause offers Open Settings on the Scraper page', async () => {
    const user = userEvent.setup();
    setup({ ...RUNNING, state: 'paused', pausedReason: 'credentials', current: null });
    await user.click(await screen.findByRole('button', { name: 'Open Settings' }));
    expect(JSON.parse(screen.getByRole('status', { name: 'windows' }).textContent)).toEqual([
      { appId: 'settings', params: { section: 'scraper' } },
    ]);
  });

  it('a finished job shows the summary and Show Needs review', async () => {
    const user = userEvent.setup();
    const { review } = setup({
      ...RUNNING,
      state: 'finished',
      done: 10,
      applied: 7,
      review: 2,
      notFound: 1,
      current: null,
    });
    expect(
      await screen.findByText('Scraped 10 games · applied 7 · review 2 · not found 1 · failed 0'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Show Needs review' }));
    expect(review()).toBe(1);
  });

  it('review: the status line wraps instead of cutting the counts off', async () => {
    setup({ ...RUNNING, state: 'paused', pausedReason: 'media', current: null });
    const line = await screen.findByText(/art couldn't be saved/);
    expect(line.className).not.toMatch(/truncate/);
  });
});
