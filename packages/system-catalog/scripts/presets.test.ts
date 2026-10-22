import { PresetCatalogSchema, templateIssues } from '@nextlevel/shared';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { slugify } from './mapping.ts';
import { buildPresets, mameProfileArgs, mostCommonCore, type PresetInput } from './presets.ts';
import { parseMameArgs, parseSystemEmulators } from './runner.ts';

const runner = readFileSync(join(import.meta.dirname, 'fixtures', 'runner.py'), 'utf8');
const NAMES = [
  'Nintendo 64',
  'Apple II',
  'Nintendo GameCube',
  'Tandy TRS-80',
  'Acorn Atom',
  'Sega Model 2',
  'Sony Playstation',
];

function input(overrides: Partial<PresetInput> = {}): PresetInput {
  return {
    launchers: {
      'Nintendo 64': {
        command:
          '%NEXTLEVEL_RUNNER% -s "Nintendo 64" -c "mupen64plus_next_libretro" -r "%romname%"',
      },
      'Apple II': { command: '%NEXTLEVEL_RUNNER% -s "Apple II" -r "%romname%"' },
      'Sony Playstation': {
        command: '%NEXTLEVEL_RUNNER% -s "Sony Playstation" -c "%core%" -r "%romname%"',
      },
    },
    systemEmulators: { ...parseSystemEmulators(runner), 'Sony Playstation': ['retroarch'] },
    mameArgs: parseMameArgs(runner),
    gamelistCores: { 'Sony Playstation': 'swanstation_libretro' },
    systemIds: new Map(NAMES.map((name) => [name, slugify(name)])),
    source: 'test',
    ...overrides,
  };
}

const built = () => buildPresets(input());
const profile = (id: string) => {
  const found = built()
    .catalog.presets.flatMap((preset) => preset.profiles)
    .find((p) => p.id === id);
  if (!found) throw new Error(`no ${id}`);
  return found;
};

describe('emulator presets (FR-EMU-7)', () => {
  it('FR-EMU-7: the output is a valid preset catalog with valid templates', () => {
    const { catalog } = built();
    expect(PresetCatalogSchema.parse(catalog)).toEqual(catalog);
    for (const p of catalog.presets.flatMap((preset) => preset.profiles)) {
      for (const arg of p.args) expect(templateIssues(arg, 'arg'), `${p.id} ${arg}`).toEqual([]);
    }
  });

  it('FR-EMU-7: RetroArch gets one profile per core with the core from launchers.json', () => {
    expect(profile('retroarch:mupen64plus_next_libretro')).toEqual({
      id: 'retroarch:mupen64plus_next_libretro',
      name: 'RetroArch – mupen64plus_next',
      systems: ['nintendo-64'],
      args: ['-L', '{emulatorDir}\\cores\\{core}.dll', '{extraArgs}', '{rom}'],
      core: 'mupen64plus_next_libretro',
      archives: 'pass',
    });
  });

  it('FR-EMU-7: a per-game %core% system uses its most common gamelist core', () => {
    expect(profile('retroarch:swanstation_libretro').systems).toEqual(['sony-playstation']);
  });

  it('FR-EMU-7: a RetroArch system with no known core gets no RetroArch profile', () => {
    expect(built().presetProfiles['apple-ii']).toEqual(['mame:apple-ii']);
  });

  it('FR-EMU-7: MAME systems get their machine arguments from the runner', () => {
    expect(profile('mame:apple-ii').args).toEqual([
      'apple2ee',
      '-gameio',
      'joy',
      '-flop1',
      '{rom}',
      '-rompath',
      '{systemDir}',
      '-skip_gameinfo',
      '{extraArgs}',
    ]);
  });

  it('D2: %MEDIA% systems get a default medium plus one profile per other medium', () => {
    expect(profile('mame:acorn-atom').args.slice(0, 5)).toEqual([
      'atom',
      '-cass',
      '{rom}',
      '-keyboardprovider',
      'dinput',
    ]);
    expect(profile('mame:acorn-atom:flop1').name).toBe('MAME – Acorn Atom (flop1)');
    expect(built().presetProfiles['acorn-atom']).toEqual([
      'mame:acorn-atom',
      'mame:acorn-atom:flop1',
    ]);
  });

  it('D2: method entries use the hand-written defaults', () => {
    expect(profile('mame:tandy-trs-80').args.slice(0, 3)).toEqual(['trs80m3', '-cass', '{rom}']);
    expect(profile('mame:tandy-trs-80:flop1').args.slice(0, 5)).toEqual([
      'trs80m3',
      '-flop1',
      '{systemDir}\\MULTIDOS.DSK',
      '-flop2',
      '{rom}',
    ]);
  });

  it('FR-EMU-7: standalone presets follow the runner, then the extra systems', () => {
    expect(built().presetProfiles['nintendo-gamecube']).toEqual(['dolphin:default']);
    // FR-EMU-4: options first, so `-e {rom}` and `-- {rom}` stay together.
    expect(profile('dolphin:default').args).toEqual(['{extraArgs}', '-b', '-e', '{rom}']);
    expect(built().presetProfiles['sony-playstation']).toEqual([
      'retroarch:swanstation_libretro',
      'duckstation:default',
    ]);
  });

  it('FR-EMU-7: emulators without a preset are reported', () => {
    expect(built().skipped).toContain('Sega Model 2: model2');
  });
});

describe('mameProfileArgs', () => {
  it('D2: drops %COMMANDS% autoboot pairs and keeps fixed autoboot text', () => {
    expect(
      mameProfileArgs([
        'mz700',
        '-cass',
        '%ROM_PATH%',
        '-autoboot_delay',
        '2',
        '-autoboot_command',
        'LOAD\\n',
      ]),
    ).toEqual([
      'mz700',
      '-cass',
      '{rom}',
      '-autoboot_delay',
      '2',
      '-autoboot_command',
      'LOAD\\n',
      '-rompath',
      '{systemDir}',
      '-skip_gameinfo',
      '{extraArgs}',
    ]);
    expect(
      mameProfileArgs([
        'x',
        '%ROM_PATH%',
        '-autoboot_delay',
        '2',
        '-autoboot_command',
        '%COMMANDS%',
      ]),
    ).toEqual(['x', '{rom}', '-rompath', '{systemDir}', '-skip_gameinfo', '{extraArgs}']);
  });

  it('maps %SYSTEM_PATH% and %CORE%, escapes braces, and keeps an existing -rp', () => {
    expect(mameProfileArgs(['bbcb', '-rp', '%SYSTEM_PATH%', '-x', 'a{b}', '%CORE%'])).toEqual([
      'bbcb',
      '-rp',
      '{systemDir}',
      '-x',
      'a{{b}}',
      '{core}',
      '-skip_gameinfo',
      '{extraArgs}',
    ]);
  });

  it('fills -%MEDIA% with the medium', () => {
    expect(mameProfileArgs(['a', '-%MEDIA%', '%ROM_PATH%'], 'cart').slice(0, 3)).toEqual([
      'a',
      '-cart',
      '{rom}',
    ]);
  });
});

describe('mostCommonCore', () => {
  it('picks the most frequent per-game core', () => {
    expect(mostCommonCore({ games: [{ core: 'a' }, { core: 'b' }, { core: 'a' }, {}] })).toBe('a');
    expect(mostCommonCore([{ core: 'x' }])).toBe('x');
    expect(mostCommonCore({ games: [] })).toBeUndefined();
  });
});
