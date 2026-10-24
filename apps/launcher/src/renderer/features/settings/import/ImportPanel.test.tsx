import { err, ok, type ImportReport, type ImportSummary, type Result } from '@nextlevel/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../../bridge.ts';
import i18n from '../../../i18n.ts';
import { installFakeBridge, renderInShell, type FakeResponses } from '../../../test-utils.tsx';
import { ImportPanel } from './ImportPanel.tsx';

afterEach(async () => {
  setBridgeForTests(null);
  await i18n.changeLanguage('en');
});

const REPORT: ImportReport = {
  source: 'C:\\NextLevelOS\\public\\data',
  token: 'token-1',
  counts: {
    systems: 8,
    menus: 2,
    menuNodes: 23,
    gamelists: 9,
    games: 19,
    collections: 2,
    collectionEntries: 8,
  },
  systems: [{ systemId: 'atari-2600', entries: 3, withFile: 2, missing: 1, newFiles: 1 }],
  mapped: [{ area: 'system', key: 'Atari 2600', reason: 'systemEnabled' }],
  unmapped: [
    { area: 'system', key: 'Imaginary Console', reason: 'unknownSystem' },
    { area: 'game', key: 'Atari 2600', reason: 'duplicateEntry', count: 3 },
  ],
  willReplace: [{ area: 'menu', key: 'menu.json', reason: 'replacesImport' }],
};

const SUMMARY: ImportSummary = {
  games: { matched: 8, inserted: 5, missing: 5 },
  collections: 2,
  menus: 2,
  settingsBackupId: 'settings-1.json',
  durationMs: 1200,
};

function setup(responses: FakeResponses = {}) {
  let folders = ['C:\\NextLevelOS\\public\\data', 'D:\\Other\\data'];
  const bridge = installFakeBridge({
    'app.pickFolder': () => {
      const [next, ...rest] = folders;
      folders = rest;
      return ok(next ?? null);
    },
    'import.inspect': () => ok({ emulatorsFolder: 'C:\\NextLevel\\emulators' }),
    'import.dryRun': () => ok(REPORT),
    'import.apply': () => ok(SUMMARY),
    ...responses,
  });
  renderInShell(<ImportPanel />);
  return bridge;
}

const button = (name: RegExp | string) => screen.getByRole('button', { name });

describe('ImportPanel', () => {
  it('FR-IMP-2, D14: choosing a folder pre-fills the emulators folder and the dry run reports reasons', async () => {
    const user = userEvent.setup();
    const bridge = setup();
    await user.click(button('Choose NextLevelOS data folder…'));
    expect(await screen.findByText('C:\\NextLevelOS\\public\\data')).toBeVisible();
    expect(await screen.findByDisplayValue('C:\\NextLevel\\emulators')).toBeVisible();
    await user.click(button('Dry run'));
    expect(await screen.findByText('No matching system in NextLevel')).toBeVisible();
    expect(screen.getByText('Listed more than once (merged)')).toBeVisible();
    expect(bridge.calls).toContainEqual({
      channel: 'import.dryRun',
      input: {
        folder: 'C:\\NextLevelOS\\public\\data',
        emulatorsFolder: 'C:\\NextLevel\\emulators',
      },
    });
  });

  it('FR-IMP-2: the report reads in Portuguese too', async () => {
    await i18n.changeLanguage('pt-BR');
    const user = userEvent.setup();
    setup();
    await user.click(
      screen.getByRole('button', { name: 'Escolher pasta de dados do NextLevelOS…' }),
    );
    await user.click(await screen.findByRole('button', { name: 'Simular' }));
    expect(await screen.findByText('Nenhum sistema correspondente no NextLevel')).toBeVisible();
  });

  it('FR-IMP-2: Import stays off until a dry run of the chosen folder exists', async () => {
    const user = userEvent.setup();
    setup();
    expect(button('Import…')).toBeDisabled();
    await user.click(button('Choose NextLevelOS data folder…'));
    await screen.findByText('C:\\NextLevelOS\\public\\data');
    expect(button('Import…')).toBeDisabled();
    await user.click(button('Dry run'));
    await screen.findByText('No matching system in NextLevel');
    expect(button('Import…')).toBeEnabled();
    await user.click(button('Choose NextLevelOS data folder…'));
    await screen.findByText('D:\\Other\\data');
    expect(button('Import…')).toBeDisabled();
  });

  it('US-B3: importing asks first, shows the stage, then the summary', async () => {
    const user = userEvent.setup();
    let finish: (value: Result<ImportSummary>) => void = () => undefined;
    const bridge = setup({
      'import.apply': () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    await user.click(button('Choose NextLevelOS data folder…'));
    await user.click(await screen.findByRole('button', { name: 'Dry run' }));
    await screen.findByText('No matching system in NextLevel');
    await user.click(button('Import…'));
    const dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'Import' }));
    bridge.emit('import.progress', { stage: 'games', done: 2000, total: 97795 });
    expect(await screen.findByText('Games: 2,000 of 97,795')).toBeVisible();
    finish(ok(SUMMARY));
    expect(
      await screen.findByText('Imported 13 games (5 missing), 2 collections and 2 menus.'),
    ).toBeVisible();
    expect(button('Open Library')).toBeVisible();
    expect(button('Open Menu Editor')).toBeVisible();
    expect(bridge.calls).toContainEqual({
      channel: 'import.apply',
      input: {
        folder: 'C:\\NextLevelOS\\public\\data',
        emulatorsFolder: 'C:\\NextLevel\\emulators',
        reportToken: 'token-1',
      },
    });
  });

  it('IA F6: a folder changed since the dry run asks for a new dry run', async () => {
    const user = userEvent.setup();
    setup({ 'import.apply': () => err('CONFLICT', 'errors.conflict') });
    await user.click(button('Choose NextLevelOS data folder…'));
    await user.click(await screen.findByRole('button', { name: 'Dry run' }));
    await screen.findByText('No matching system in NextLevel');
    await user.click(button('Import…'));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Import' }));
    expect(await screen.findByText('The folder changed — run the dry run again.')).toBeVisible();
    expect(button('Import…')).toBeDisabled();
  });
});
