import {
  defaultSettings,
  err,
  GAME_ART_KINDS,
  IDLE_BATCH,
  ok,
  type BatchRules,
} from '@nextlevel/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell, type FakeResponses } from '../../test-utils.tsx';
import { SNES } from '../library/testing.ts';
import { useShell } from '../shell/ShellContext.tsx';
import { BatchRulesDialog } from './BatchRulesDialog.tsx';

function WindowsProbe() {
  const { state } = useShell();
  return (
    <output aria-label="windows">
      {JSON.stringify(state.windows.map((w) => ({ appId: w.appId, params: w.params })))}
    </output>
  );
}

afterEach(() => {
  setBridgeForTests(null);
});

function setup(responses: FakeResponses = {}) {
  const started: Array<{ scope: unknown; rules: BatchRules }> = [];
  installFakeBridge({
    'scraper.batch.start': (input) => {
      started.push(input);
      return ok({ ...IDLE_BATCH, jobId: 1, state: 'running' });
    },
    ...responses,
  });
  let closed = 0;
  renderInShell(
    <div className="relative">
      <BatchRulesDialog
        scope={{ systemIds: ['snes'] }}
        title="Super Nintendo"
        onClose={() => {
          closed += 1;
        }}
      />
      <WindowsProbe />
    </div>,
  );
  return { started, closed: () => closed };
}

describe('BatchRulesDialog (FR-SCR-2, US-C6, D18)', () => {
  it('US-C6: opens with the Settings defaults and Start begins the job', async () => {
    const user = userEvent.setup();
    const { started, closed } = setup();
    const dialog = await screen.findByRole('dialog', { name: 'Scrape Super Nintendo' });
    expect(
      within(dialog).getByRole('checkbox', { name: 'Only missing art and fields' }),
    ).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'Box front' })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'Fanart' })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'Box back' })).not.toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'Genre' })).toBeChecked();
    expect(within(dialog).queryByRole('checkbox', { name: 'Title' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('checkbox', { name: 'Fanart' }));
    await user.click(within(dialog).getByRole('button', { name: 'Start' }));
    await waitFor(() => {
      expect(closed()).toBe(1);
    });
    const defaults = defaultSettings().scraper;
    expect(started).toEqual([
      {
        scope: { systemIds: ['snes'] },
        rules: {
          onlyMissing: true,
          kinds: GAME_ART_KINDS.filter((k) => k !== 'fanart' && defaults.artKinds.includes(k)),
          fields: defaults.fields.filter((field) => field !== 'title'),
          regions: defaults.regionPriority,
        },
      },
    ]);
  });

  it('Start is off with no kind and no field', async () => {
    const user = userEvent.setup();
    setup();
    const dialog = await screen.findByRole('dialog');
    for (const box of within(dialog).getAllByRole('checkbox')) {
      if (
        box.getAttribute('aria-label') !== 'Only missing art and fields' &&
        (box as HTMLInputElement).checked
      ) {
        await user.click(box);
      }
    }
    expect(within(dialog).getByRole('button', { name: 'Start' })).toBeDisabled();
  });

  it('a refusal (no ScreenScraper system) is shown and the dialog stays', async () => {
    const user = userEvent.setup();
    const { closed } = setup({
      'scraper.batch.start': () =>
        err('NO_SCRAPER_SYSTEM', 'errors.noScraperSystem', { systemIds: ['snes'] }),
    });
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Start' }));
    expect(await within(dialog).findByRole('alert')).toBeVisible();
    expect(closed()).toBe(0);
  });

  it('review: a batch already there is named as such, not as a scan', async () => {
    const user = userEvent.setup();
    setup({ 'scraper.batch.start': () => err('BUSY', 'errors.busy', { batch: true }) });
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Start' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /batch scrape is already running or paused/i,
    );
  });

  it('review: systems without a ScreenScraper id are named, with Open Settings on Systems', async () => {
    const user = userEvent.setup();
    setup({
      'systems.catalog': () => ok([SNES]),
      'scraper.batch.start': () =>
        err('NO_SCRAPER_SYSTEM', 'errors.noScraperSystem', { systemIds: ['snes'] }),
    });
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Start' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Super Nintendo');
    await user.click(within(dialog).getByRole('button', { name: 'Open Settings' }));
    expect(JSON.parse(screen.getByRole('status', { name: 'windows' }).textContent)).toEqual([
      { appId: 'settings', params: { section: 'systems', focusId: 'snes' } },
    ]);
  });
});
