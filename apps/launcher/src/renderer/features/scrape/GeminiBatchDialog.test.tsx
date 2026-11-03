import { defaultSettings, IDLE_BATCH, ok, type BatchStatus } from '@nextlevel/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { BatchProgress } from './BatchProgress.tsx';
import { GeminiBatchDialog } from './GeminiBatchDialog.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

function setup(options: { key?: boolean; toolPaths?: boolean } = {}) {
  const settings = defaultSettings();
  if (options.toolPaths) {
    settings.scraper.gemini.webTool = {
      python: 'C:/Python/python.exe',
      firefoxProfile: 'C:/ff/profile',
      driver: '',
    };
  }
  const started: unknown[] = [];
  installFakeBridge({
    'settings.get': () => ok({ kind: 'ok', snapshot: { settings, revision: 0 } }),
    'gemini.key.status': () => ok({ available: true, set: options.key ?? true }),
    'gemini.batch.start': (input) => {
      started.push(input);
      return ok({ ...IDLE_BATCH, jobId: 1, state: 'running' as const });
    },
  });
  let closed = 0;
  renderInShell(
    <div className="relative">
      <GeminiBatchDialog
        scope={{ systemIds: ['coleco-telstar'] }}
        title="Coleco Telstar"
        onClose={() => {
          closed += 1;
        }}
      />
    </div>,
  );
  return { started, closed: () => closed };
}

describe('Fill details with Gemini — batch (FR-SCR-7)', () => {
  it('FR-SCR-7: defaults to all six fields, Review and the Gemini API; Start sends them', async () => {
    const user = userEvent.setup();
    const { started, closed } = setup();
    expect(
      await screen.findByRole('dialog', { name: 'Fill Coleco Telstar details with Gemini' }),
    ).toBeInTheDocument();
    for (const name of ['Description', 'Year', 'Developer', 'Publisher', 'Genre', 'Players']) {
      expect(screen.getByRole('checkbox', { name })).toBeChecked();
    }
    expect(screen.queryByRole('checkbox', { name: 'Title' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Review' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Gemini API' })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Description' }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(started).toEqual([
      {
        scope: { systemIds: ['coleco-telstar'] },
        rules: {
          fields: ['year', 'developer', 'publisher', 'genre', 'players'],
          mode: 'review',
          route: 'api',
        },
      },
    ]);
    await screen.findByRole('dialog');
    expect(closed()).toBe(1);
  });

  it('FR-SCR-7: Auto-update says answers are saved without review', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(await screen.findByRole('radio', { name: 'Auto-update' }));
    expect(screen.getByText('Answers are saved without review.')).toBeInTheDocument();
  });

  it('FR-SCR-7: the website route warns about sources and Firefox, and needs its paths', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(await screen.findByRole('radio', { name: 'Gemini website tool' }));
    expect(screen.getByText(/the website gives no sources/i)).toBeInTheDocument();
    expect(screen.getByText(/close Firefox/i)).toBeInTheDocument();
    expect(screen.getByText('Set up the website tool in Settings → Scraper first.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
  });

  it('FR-SCR-7: with its paths set, the website route can start without an API key', async () => {
    const user = userEvent.setup();
    const { started } = setup({ key: false, toolPaths: true });
    await user.click(await screen.findByRole('radio', { name: 'Gemini website tool' }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(started).toHaveLength(1);
  });

  it('FR-SCR-7: no key on the API route: Start is disabled and the dialog says why', async () => {
    setup({ key: false });
    expect(
      await screen.findByText('Add a Gemini API key in Settings → Scraper first.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
  });
});

describe('Gemini batch progress (FR-SCR-7)', () => {
  const RUNNING: BatchStatus = {
    ...IDLE_BATCH,
    jobId: 2,
    state: 'running',
    total: 10,
    done: 3,
    applied: 2,
    review: 1,
  };

  it('FR-SCR-7: shows its own counts, and Pause goes to the Gemini batch', async () => {
    const user = userEvent.setup();
    const bridge = installFakeBridge({ 'gemini.batch.pause': () => ok(RUNNING) });
    renderInShell(<BatchProgress kind="gemini" status={RUNNING} />);
    expect(screen.getByText('Gemini 3/10 · saved 2 · review 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(bridge.channels()).toContain('gemini.batch.pause');
  });

  it('FR-SCR-7: the daily limit pause says when it resumes and offers the website tool', () => {
    installFakeBridge();
    renderInShell(
      <BatchProgress
        kind="gemini"
        status={{
          ...RUNNING,
          state: 'paused',
          pausedReason: 'gemini-quota',
          resumeAt: '2026-12-11T08:00:00.000Z',
        }}
      />,
    );
    expect(
      screen.getByText(/Gemini's free daily limit is used up; it resumes at .+ \(3\/10\)/),
    ).toBeInTheDocument();
  });
});
