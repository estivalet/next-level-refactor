import { err, ok, type GeminiDialogView, type ScrapeApplyResult } from '@nextlevel/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell, type FakeResponses } from '../../test-utils.tsx';
import { gameDetails, gameRow } from '../library/testing.ts';
import { GeminiDialog } from './GeminiDialog.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

const GAME = gameDetails(gameRow(7, 'Tennis'), { developer: 'Coleco' });
const VIEW: GeminiDialogView = {
  answer: {
    gameId: 7,
    route: 'api',
    fields: {
      year: { known: true, value: 1976 },
      developer: { known: true, value: 'Coleco Industries' },
      publisher: { known: false, value: null },
    },
    title: 'Telstar Tennis',
    sources: [{ title: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Coleco_Telstar' }],
    grounded: true,
    askedAt: '2026-11-03T12:00:00.000Z',
  },
  fields: {
    year: { current: null, scraped: 1976, locked: false },
    developer: { current: 'Coleco', scraped: 'Coleco Industries', locked: false },
    publisher: { current: null, scraped: null, locked: false },
    title: { current: 'Tennis', scraped: 'Telstar Tennis', locked: false },
  },
};
const APPLIED: ScrapeApplyResult = { written: [], failed: [], game: GAME };

function setup(responses: FakeResponses = {}) {
  const fake = installFakeBridge({
    'library.games.get': () => ok(GAME),
    'gemini.key.status': () => ok({ available: true, set: true }),
    'gemini.stored': () => ok(null),
    'gemini.ask': () => ok(VIEW),
    'gemini.apply': () => ok(APPLIED),
    'gemini.dismiss': () => ok(undefined),
    ...responses,
  });
  let closed = 0;
  renderInShell(
    <div className="relative">
      <GeminiDialog
        gameId={7}
        onClose={() => {
          closed += 1;
        }}
      />
    </div>,
  );
  const calls = (channel: string) => fake.calls.filter((call) => call.channel === channel);
  return { calls, closed: () => closed };
}

describe('Fill details with Gemini (FR-SCR-7)', () => {
  it('FR-SCR-7: asks on open; empty fields with an answer are ticked, filled ones and the title not', async () => {
    const { calls } = setup();
    expect(
      await screen.findByRole('dialog', { name: 'Fill details with Gemini: Tennis' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: 'Year' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Developer' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Title' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Publisher' })).toBeDisabled();
    expect(screen.getByText("Gemini doesn't know")).toBeInTheDocument();
    expect(calls('gemini.ask')[0]?.input).toEqual({ gameId: 7 });
  });

  it('FR-SCR-7: lists the sources Gemini used as links', async () => {
    setup();
    const link = await screen.findByRole('link', { name: 'Wikipedia' });
    expect(link).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Coleco_Telstar');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('FR-SCR-7: Apply sends the ticked fields and closes', async () => {
    const user = userEvent.setup();
    const { calls, closed } = setup();
    await user.click(await screen.findByRole('checkbox', { name: 'Title' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(calls('gemini.apply')[0]?.input).toEqual({ gameId: 7, fields: ['year', 'title'] });
    await screen.findByRole('dialog');
    expect(closed()).toBe(1);
  });

  it('FR-SCR-7: Ask about all fields asks again with allFields', async () => {
    const user = userEvent.setup();
    const { calls } = setup();
    await user.click(await screen.findByRole('button', { name: 'Ask about all fields' }));
    expect(calls('gemini.ask')[1]?.input).toEqual({ gameId: 7, allFields: true });
  });

  it('FR-SCR-7: a stored answer (Needs review) opens without asking; Dismiss clears it', async () => {
    const user = userEvent.setup();
    const { calls, closed } = setup({ 'gemini.stored': () => ok(VIEW) });
    expect(await screen.findByRole('checkbox', { name: 'Year' })).toBeChecked();
    expect(calls('gemini.ask')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(calls('gemini.dismiss')[0]?.input).toEqual({ gameId: 7 });
    expect(closed()).toBe(1);
    expect(calls('gemini.ask')).toHaveLength(0);
  });

  it('FR-SCR-7: without a key the dialog says so and asks nothing', async () => {
    const { calls } = setup({ 'gemini.key.status': () => ok({ available: true, set: false }) });
    const dialog = await screen.findByRole('dialog');
    expect(
      await within(dialog).findByText('Add a Gemini API key in Settings → Scraper first.'),
    ).toBeInTheDocument();
    expect(calls('gemini.ask')).toHaveLength(0);
  });

  it('FR-SCR-7: the daily limit says to try tomorrow or use the website tool', async () => {
    setup({ 'gemini.ask': () => err('GEMINI_QUOTA', 'errors.geminiQuota') });
    expect(
      await screen.findByText(
        "Gemini's free daily limit is used up. Try again tomorrow, or use the Gemini website tool.",
      ),
    ).toBeInTheDocument();
  });
});
