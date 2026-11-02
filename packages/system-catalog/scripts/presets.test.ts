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
  'HBMAME',
  'Microsoft MSX',
  'Microsoft MSX Turbo R',
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
      '-uimodekey',
      'DEL',
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

  it('FR-EMU-4: a MAME profile keeps the delay of the autoboot pair it drops', () => {
    expect(profile('mame:acorn-atom').autobootDelay).toBe('2');
    expect(profile('mame:acorn-atom:flop1').autobootDelay).toBe('2');
    expect(profile('mame:apple-ii').autobootDelay).toBeUndefined();
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

  it('FR-EMU-7: HBMAME starts like NextLevelOS: Delete toggles the UI, ROM folder, then the game', () => {
    expect(built().presetProfiles['hbmame']).toEqual(['hbmame:default']);
    expect(profile('hbmame:default').args).toEqual([
      '{extraArgs}',
      '-uimodekey',
      'DEL',
      '-skip_gameinfo',
      '-rompath',
      '{systemDir}',
      '{rom}',
    ]);
  });

  it('FR-EMU-7: openMSX starts like NextLevelOS, with a variant per runner key and its home in its folder', () => {
    expect(built().presetProfiles['microsoft-msx']?.[0]).toBe('openmsx:default');
    expect(profile('openmsx:default')).toMatchObject({
      args: ['{extraArgs}', '-setting', '{emulatorDir}\\share\\settings.xml', '{rom}'],
      env: { OPENMSX_HOME: '{emulatorDir}' },
    });
    expect(built().presetProfiles['microsoft-msx-turbo-r']).toEqual(['openmsx:turbor']);
    expect(profile('openmsx:turbor').args).toEqual([
      '{extraArgs}',
      '-setting',
      '{emulatorDir}\\share\\turbor.xml',
      '{rom}',
    ]);
  });

  it('FR-EMU-7: emulators without a preset are reported', () => {
    expect(built().skipped).toContain('Sega Model 2: model2');
  });

  describe('Laserdisc and VHS (FR-EMU-9)', () => {
    const LASERDISC = {
      Singe: ['hypseus_singe'],
      'Mattel Captain Power': ['hypseus_singe'],
      'Sega Video Driver': ['hypseus_singe'],
      'WoW Action Max': ['hypseus_singe'],
      Daphne: ['hypseus'],
      'VM Labs Nuon': ['script'],
      'Pioneer LaserActive': ['script'],
      'Coleco Telstar': ['script'],
    };
    const laserdisc = () =>
      buildPresets(
        input({
          systemEmulators: LASERDISC,
          systemIds: new Map(Object.keys(LASERDISC).map((name) => [name, slugify(name)])),
        }),
      );
    const find = (id: string) =>
      laserdisc()
        .catalog.presets.flatMap((preset) => preset.profiles)
        .find((p) => p.id === id);

    it('FR-EMU-7: Singe, Captain Power, Video Driver and Action Max get hypseus:default; Daphne gets hypseus:daphne', () => {
      const { presetProfiles } = laserdisc();
      for (const id of ['singe', 'mattel-captain-power', 'sega-video-driver', 'wow-action-max']) {
        expect(presetProfiles[id]).toEqual(['hypseus:default']);
      }
      expect(presetProfiles['daphne']).toEqual(['hypseus:daphne']);
      expect(find('hypseus:default')).toMatchObject({
        squashfs: 'mount',
        args: [
          'singe',
          'vldp',
          '-framefile',
          '{gameDir}\\{romName}.txt',
          '{entryArgs}',
          '-fullscreen',
          '-opengl',
          '{extraArgs}',
        ],
      });
      expect(find('hypseus:default')?.entries?.map((rule) => rule.file)).toEqual([
        '{gameDir}\\{romName}.singe',
        '{gameDir}\\{romName}.zip',
        '{gameDir}\\*.zip',
      ]);
      expect(find('hypseus:daphne')).toMatchObject({
        squashfs: 'mount',
        argsFile: '{gameDir}\\{romName}.commands',
      });
      expect(find('hypseus:daphne')?.args.slice(0, 2)).toEqual(['{romName}', 'vldp']);
    });

    it('FR-EMU-7: script systems (VM Labs Nuon, Pioneer LaserActive, Coleco Telstar) get script:default', () => {
      const { presetProfiles, catalog } = laserdisc();
      for (const id of ['vm-labs-nuon', 'pioneer-laseractive']) {
        expect(presetProfiles[id]).toEqual(['script:default']);
      }
      expect(presetProfiles['coleco-telstar']).toEqual(['script:default', 'script:winarcadia']);
      expect(find('script:default')).toMatchObject({
        args: ['/d', '/s', '/c', '""{rom}""', '{extraArgs}'],
        cwd: '{romDir}',
      });
      expect(catalog.presets.find((preset) => preset.id === 'script')?.windowsTool).toBe(true);
    });

    it('FR-EMU-9: Script is offered only to systems whose games are scripts', () => {
      const { presetProfiles, skipped } = buildPresets(
        input({
          systemEmulators: LASERDISC,
          systemIds: new Map(Object.keys(LASERDISC).map((name) => [name, slugify(name)])),
          systemExtensions: new Map([
            ['vm-labs-nuon', ['bat']],
            ['pioneer-laseractive', ['bat']],
            ['coleco-telstar', ['zip', '7z']],
          ]),
        }),
      );
      expect(presetProfiles['vm-labs-nuon']).toEqual(['script:default']);
      expect(presetProfiles['coleco-telstar']).toEqual(['script:winarcadia']);
      expect(skipped).toContain('Coleco Telstar: script (no .bat/.cmd/.lnk games)');
    });

    it('FR-EMU-7: Coleco Telstar models run the WinArcadia in each game folder', () => {
      const models = ['Coleco Telstar', 'Coleco Telstar Alpha', 'Coleco Telstar Sportsman'];
      const { presetProfiles, catalog } = buildPresets(
        input({
          systemEmulators: { 'Coleco Telstar': ['script'] },
          systemIds: new Map(models.map((name) => [name, slugify(name)])),
          systemExtensions: new Map(models.map((name) => [slugify(name), ['zip']])),
        }),
      );
      for (const name of models) {
        expect(presetProfiles[slugify(name)]).toEqual(['script:winarcadia']);
      }
      const script = catalog.presets.find((preset) => preset.id === 'script');
      expect(script?.profiles.map((p) => p.id)).toEqual(['script:winarcadia']);
      expect(script?.profiles[0]).toMatchObject({
        name: 'WinArcadia (game folder)',
        args: ['/d', '/s', '/c', 'wa.exe', '{extraArgs}'],
        cwd: '{rom}',
        archives: 'pass',
      });
      expect(templateIssues(script?.profiles[0]?.cwd ?? '', 'value')).toEqual([]);
    });

    it('FR-EMU-9: new preset templates and rules are valid profile templates', () => {
      const { catalog } = laserdisc();
      expect(PresetCatalogSchema.parse(catalog)).toEqual(catalog);
      for (const p of catalog.presets.flatMap((preset) => preset.profiles)) {
        for (const rule of p.entries ?? []) {
          expect(templateIssues(rule.file, 'value')).toEqual([]);
          for (const arg of rule.args) expect(templateIssues(arg, 'entry')).toEqual([]);
        }
        if (p.argsFile) expect(templateIssues(p.argsFile, 'value')).toEqual([]);
      }
    });
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
      '-uimodekey',
      'DEL',
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
    ).toEqual([
      'x',
      '{rom}',
      '-rompath',
      '{systemDir}',
      '-uimodekey',
      'DEL',
      '-skip_gameinfo',
      '{extraArgs}',
    ]);
  });

  it('maps %SYSTEM_PATH% and %CORE%, escapes braces, and keeps an existing -rp', () => {
    expect(mameProfileArgs(['bbcb', '-rp', '%SYSTEM_PATH%', '-x', 'a{b}', '%CORE%'])).toEqual([
      'bbcb',
      '-rp',
      '{systemDir}',
      '-x',
      'a{{b}}',
      '{core}',
      '-uimodekey',
      'DEL',
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
