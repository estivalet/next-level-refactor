import { IDLE_BATCH, ok, type BatchScope } from '@nextlevel/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { LibraryApp } from '../library/LibraryApp.tsx';
import { gameRow, libraryResponses } from '../library/testing.ts';

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
});
afterEach(() => {
  setBridgeForTests(null);
  vi.restoreAllMocks();
});

function setup() {
  const started: BatchScope[] = [];
  installFakeBridge({
    ...libraryResponses([gameRow(1, 'Alpha'), gameRow(2, 'Bravo'), gameRow(3, 'Charlie')]),
    'scraper.batch.status': () => ok(IDLE_BATCH),
    'scraper.batch.start': ({ scope }) => {
      started.push(scope);
      return ok({ ...IDLE_BATCH, jobId: 1, state: 'running', total: 3 });
    },
  });
  renderInShell(<LibraryApp />);
  return { started };
}

describe('batch scrape in the Library (FR-SCR-2, US-C6)', () => {
  it('US-C6: Scrape <system>… opens the rules with Settings defaults, Start begins the job', async () => {
    const user = userEvent.setup();
    const { started } = setup();
    await screen.findByRole('option', { name: /Alpha/ });
    await user.click(screen.getByRole('button', { name: 'Scrape' }));
    await user.click(screen.getByRole('menuitem', { name: 'Scrape Nintendo 64…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Scrape Nintendo 64' });
    expect(within(dialog).getByRole('checkbox', { name: 'Box front' })).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Start' }));
    await waitFor(() => {
      expect(started).toEqual([{ systemIds: ['nintendo-64'] }]);
    });
    expect(await screen.findByText('Scraping 0/3 · applied 0 · review 0')).toBeVisible();
  });

  it('US-C6: the context menu of a multi-selection offers Scrape selected games', async () => {
    const user = userEvent.setup();
    const { started } = setup();
    await user.click(await screen.findByRole('option', { name: /Alpha/ }));
    await user.keyboard('{Shift>}');
    await user.click(screen.getByRole('option', { name: /Charlie/ }));
    await user.keyboard('{/Shift}');
    await user.keyboard('{Shift>}{F10}{/Shift}');
    await user.click(screen.getByRole('menuitem', { name: 'Scrape 3 selected games…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Scrape 3 selected games' });
    await user.click(within(dialog).getByRole('button', { name: 'Start' }));
    await waitFor(() => {
      expect(started).toEqual([{ gameIds: [1, 2, 3] }]);
    });
  });
});
