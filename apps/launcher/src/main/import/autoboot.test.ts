import { SettingsSchema } from '@nextlevel/shared';
import { emulatorPresets } from '@nextlevel/system-catalog';
import { describe, expect, it } from 'vitest';
import { addAutoboot, autobootText } from './autoboot.ts';
import type { GameImport } from './mapGames.ts';

describe('autobootText (FR-EMU-4)', () => {
  // The gamelist values, JSON-decoded, as NextLevelOS users wrote them for its command line.
  it.each([
    ['*DOS\\n*RUN\\"EHRUN\\"\\n', '*DOS\\n*RUN"EHRUN"\\n'],
    ['RUN\\&quot;FROGGER\\&quot;\\n', 'RUN"FROGGER"\\n'],
    ['LOAD\\&quot;\\&quot;\\n', 'LOAD""\\n'],
    ['MLOAD""INVADERS""\\n', 'MLOAD"INVADERS"\\n'],
    ['CLOADM:EXEC\\n', 'CLOADM:EXEC\\n'],
  ])('%s → %s', (raw, text) => {
    expect(autobootText(raw)).toBe(text);
  });
});

const MAME = '01900000-0000-7000-8000-0000000000e1';
const ATOM = '01900000-0000-7000-8000-0000000000f1';
const APPLE = '01900000-0000-7000-8000-0000000000f2';

function settings() {
  return SettingsSchema.parse({
    schemaVersion: 2,
    systems: {
      'acorn-atom': { enabled: true, defaultProfileId: ATOM },
      'apple-ii': { enabled: true, defaultProfileId: APPLE },
    },
    emulators: [{ id: MAME, name: 'MAME', presetId: 'mame', executable: 'E:\\MAME\\mame.exe' }],
    profiles: [
      {
        id: ATOM,
        name: 'MAME – Acorn Atom',
        emulatorId: MAME,
        systems: ['acorn-atom'],
        args: ['atom', '-cass', '{rom}', '{extraArgs}'],
        archives: 'pass',
        env: {},
        presetProfileId: 'mame:acorn-atom',
      },
      {
        id: APPLE,
        name: 'MAME – Apple II',
        emulatorId: MAME,
        systems: ['apple-ii'],
        args: ['apple2ee', '-flop1', '{rom}', '{extraArgs}'],
        archives: 'pass',
        env: {},
        presetProfileId: 'mame:apple-ii',
      },
    ],
  });
}

const game = (systemId: string, extra: Partial<GameImport> = {}): GameImport => ({
  systemId,
  relPath: 'game.zip',
  discGroup: null,
  metadata: {},
  filters: [],
  favorite: false,
  completed: false,
  hidden: false,
  playCount: 0,
  lastPlayedAt: null,
  override: null,
  presetProfileId: null,
  autoboot: 'CLOAD\\n',
  arcade: null,
  ...extra,
});

describe('addAutoboot (FR-EMU-4)', () => {
  it('types the game’s command after its profile’s autoboot delay', () => {
    const { games, items } = addAutoboot([game('acorn-atom')], settings(), emulatorPresets());
    expect(games[0]?.override).toEqual({
      core: null,
      extraArgs: ['-autoboot_delay', '2', '-autoboot_command', 'CLOAD\\n'],
    });
    expect(items).toEqual([{ area: 'game', key: 'acorn-atom', reason: 'mameAutoboot', count: 1 }]);
  });

  it('follows the game’s own MAME medium, and keeps its other extra arguments', () => {
    const own = game('acorn-atom', {
      presetProfileId: 'mame:acorn-atom:flop1',
      override: { core: null, extraArgs: ['-x'] },
    });
    const { games } = addAutoboot([own], settings(), emulatorPresets());
    expect(games[0]?.override?.extraArgs).toEqual([
      '-x',
      '-autoboot_delay',
      '2',
      '-autoboot_command',
      'CLOAD\\n',
    ]);
  });

  it('leaves a game alone when its profile has no autoboot (and reports it)', () => {
    const { games, items } = addAutoboot([game('apple-ii')], settings(), emulatorPresets());
    expect(games[0]?.override).toBeNull();
    expect(items).toEqual([{ area: 'game', key: 'apple-ii', reason: 'perGameEmulator', count: 1 }]);
  });
});
