import { IDLE_BATCH, ok, type BatchStatus } from '@nextlevel/shared';
import { getSystem, systemCatalog } from '@nextlevel/system-catalog';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { BatchProgress } from './BatchProgress.tsx';
import { ScrapeMenu } from './ScrapeMenu.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

const RUNNING: BatchStatus = {
  ...IDLE_BATCH,
  jobId: 1,
  state: 'running',
  total: 10,
  done: 3,
  applied: 2,
  review: 1,
  systemIds: ['nintendo-snes'],
};
const SNES = getSystem('nintendo-snes')?.name ?? '';

function setup(status: BatchStatus) {
  // Main pauses or cancels after the current game, so the control call still answers "running".
  const fake = installFakeBridge({
    'systems.catalog': () => ok([...systemCatalog()]),
    'scraper.batch.status': () => ok(status),
    'scraper.batch.pause': () => ok(status),
    'scraper.batch.cancel': () => ok(status),
  });
  renderInShell(
    <ScrapeMenu
      system={{ id: 'snes', name: 'Super Nintendo' }}
      selectedIds={[]}
      onRules={() => undefined}
      onShowReview={() => undefined}
    />,
  );
  return fake;
}

describe('BatchProgress (FR-SCR-2, US-C6)', () => {
  it('the finished summary counts one game in the singular', async () => {
    setup({ ...RUNNING, state: 'finished', total: 1, done: 1, applied: 1, review: 0 });
    expect(
      await screen.findByText('Scraped 1 game · applied 1 · review 0 · not found 0 · failed 0'),
    ).toBeVisible();
  });

  it('done never shows above total', async () => {
    setup({ ...RUNNING, total: 5, done: 7 });
    expect(await screen.findByText(`Scraping ${SNES} 5/5 · applied 2 · review 1`)).toBeVisible();
  });

  it('Pause reads Pausing… and is disabled until the job has paused', async () => {
    const user = userEvent.setup();
    const fake = setup(RUNNING);
    await user.click(await screen.findByRole('button', { name: 'Pause' }));
    const pausing = await screen.findByRole('button', { name: 'Pausing…' });
    expect(pausing).toBeDisabled();
    fake.emit('scraper.batch.progress', { ...RUNNING, state: 'paused', pausedReason: 'user' });
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Pausing…' })).not.toBeInTheDocument();
  });

  it('Cancel reads Cancelling… and is disabled until the job has stopped', async () => {
    const user = userEvent.setup();
    const fake = setup(RUNNING);
    await user.click(await screen.findByRole('button', { name: 'Cancel scraping' }));
    expect(await screen.findByRole('button', { name: 'Cancelling…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled();
    fake.emit('scraper.batch.progress', { ...RUNNING, state: 'finished' });
    expect(await screen.findByText(/^Scraped 3 games/)).toBeVisible();
  });

  it('NFR-A11Y-1: a batch resuming on its own (quota timer) never takes the keyboard', async () => {
    const fake = setup({ ...RUNNING, state: 'paused', pausedReason: 'quota' });
    await screen.findByRole('button', { name: 'Resume' });
    (document.activeElement as HTMLElement | null)?.blur();
    fake.emit('scraper.batch.progress', RUNNING);
    expect(await screen.findByRole('button', { name: 'Pause' })).not.toHaveFocus();
    expect(document.activeElement).toBe(document.body);
  });

  it('NFR-A11Y-1: Resume hands the keyboard to Pause', async () => {
    const user = userEvent.setup();
    const paused = { ...RUNNING, state: 'paused' as const, pausedReason: 'user' as const };
    installFakeBridge({
      'scraper.batch.status': () => ok(paused),
      'scraper.batch.resume': () => ok(RUNNING),
    });
    renderInShell(<ScrapeMenu system={null} selectedIds={[]} onRules={() => undefined} />);
    await user.click(await screen.findByRole('button', { name: 'Resume' }));
    expect(await screen.findByRole('button', { name: 'Pause' })).toHaveFocus();
  });

  it('FR-SCR-6: games filled from LaunchBox are named in the counts', async () => {
    setup({ ...RUNNING, applied: 3, launchbox: 2 });
    expect(await screen.findByText(/applied 3 · review 1 · 2 from LaunchBox$/)).toBeVisible();
  });

  it('FR-SCR-6: a pause for the missing LaunchBox database says so and opens Settings', async () => {
    setup({ ...RUNNING, state: 'paused', pausedReason: 'launchbox' });
    expect(
      await screen.findByText(
        'Paused: download the LaunchBox database or turn off Then fill from LaunchBox (3/10)',
      ),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Open Settings' })).toBeVisible();
  });

  it('US-C8: the strip names the system it scrapes', async () => {
    setup(RUNNING);
    expect(await screen.findByText(`Scraping ${SNES} 3/10 · applied 2 · review 1`)).toBeVisible();
  });

  it('US-C8: several systems are counted', async () => {
    setup({ ...RUNNING, systemIds: ['nintendo-snes', 'nintendo-n64'] });
    expect(await screen.findByText('Scraping 2 systems 3/10 · applied 2 · review 1')).toBeVisible();
  });

  it('US-C8: a selection job reads "selected games"', async () => {
    setup({ ...RUNNING, systemIds: null });
    expect(
      await screen.findByText('Scraping selected games 3/10 · applied 2 · review 1'),
    ).toBeVisible();
  });

  it('US-C8: a job resumed after a restart says so with its start date', async () => {
    setup({
      ...RUNNING,
      jobId: 41,
      startedAt: '2026-11-17T21:04:00.000Z',
      resumedAt: '2026-11-19T09:00:00.000Z',
    });
    expect(await screen.findByText(/^Resumed · started /)).toBeVisible();
  });

  it('US-C8: clicking the status text opens the details', async () => {
    const user = userEvent.setup();
    let opened = 0;
    installFakeBridge({ 'systems.catalog': () => ok([...systemCatalog()]) });
    renderInShell(
      <BatchProgress
        status={RUNNING}
        onOpenDetails={() => {
          opened += 1;
        }}
      />,
    );
    await user.click(await screen.findByRole('button', { name: /Show scrape details$/ }));
    expect(opened).toBe(1);
  });
});
