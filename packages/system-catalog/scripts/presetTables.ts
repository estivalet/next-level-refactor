// Hand-written preset data the runner can't provide as plain tables. Arguments are in the runner's
// placeholder form (%ROM_PATH%, %SYSTEM_PATH%) and go through mameProfileArgs like parsed ones.

export interface StandaloneSpec extends GameFileSpec {
  id: string;
  name: string;
  executableNames: string[];
  homepage: string;
  args: string[];
  archives: 'pass' | 'extract';
  /** Environment templates every profile of the preset starts with. */
  env?: Record<string, string>;
  /** Runner emulator keys (SYSTEM_EMULATORS values) this preset replaces. */
  runnerKeys: string[];
  /** Runner keys that start the emulator differently: their systems get `<id>:<suffix>`. */
  variants?: Record<string, { suffix: string; name: string; args: string[] } & GameFileSpec>;
  /** Working folder template (default `{emulatorDir}`). */
  cwd?: string;
  /** The program is a Windows tool in System32 (cmd.exe), found without a folder to search. */
  windowsTool?: boolean;
  /** A game's extra args go at the end (Hypseus wants `<game> vldp` first), not the front. */
  extraArgsLast?: boolean;
  /** NextLevelOS system names to add after the runner's choices. */
  extraSystems: string[];
}

/** FR-EMU-9 profile parts: squashfs mounting, game file rules and an args file. */
export interface GameFileSpec {
  squashfs?: 'pass' | 'mount';
  entries?: Array<{ file: string; args: string[] }>;
  argsFile?: string;
}

export const RETROARCH = {
  id: 'retroarch',
  name: 'RetroArch',
  executableNames: ['retroarch.exe'],
  homepage: 'https://www.retroarch.com/',
};

export const MAME = {
  id: 'mame',
  name: 'MAME',
  executableNames: ['mame.exe', 'mame64.exe'],
  homepage: 'https://www.mamedev.org/',
};

// Arguments from the runner's get_launcher_command where it has the emulator, otherwise from the
// emulator's documented command line (linked per entry).
export const STANDALONE: readonly StandaloneSpec[] = [
  {
    // https://dolphin-emu.org/docs/guides/controlling-global-configuration-command-line-options/
    id: 'dolphin',
    name: 'Dolphin',
    executableNames: ['Dolphin.exe'],
    homepage: 'https://dolphin-emu.org/',
    args: ['-b', '-e', '{rom}'],
    archives: 'extract',
    runnerKeys: ['dolphin'],
    extraSystems: [],
  },
  {
    id: 'pcsx2',
    name: 'PCSX2',
    executableNames: ['pcsx2-qt.exe', 'pcsx2.exe'],
    homepage: 'https://pcsx2.net/',
    args: ['-fullscreen', '--', '{rom}'],
    archives: 'extract',
    runnerKeys: ['pcsx2'],
    extraSystems: [],
  },
  {
    // https://github.com/stenzek/duckstation#command-line (-batch exits with the game)
    id: 'duckstation',
    name: 'DuckStation',
    executableNames: ['duckstation-qt-x64-ReleaseLTCG.exe', 'duckstation-qt.exe'],
    homepage: 'https://www.duckstation.org/',
    args: ['-fullscreen', '-batch', '--', '{rom}'],
    archives: 'extract',
    runnerKeys: [],
    extraSystems: ['Sony Playstation'],
  },
  {
    // https://www.ppsspp.org/docs/reference/command-line/
    id: 'ppsspp',
    name: 'PPSSPP',
    executableNames: ['PPSSPPWindows64.exe', 'PPSSPPWindows.exe'],
    homepage: 'https://www.ppsspp.org/',
    args: ['--fullscreen', '{rom}'],
    archives: 'extract',
    runnerKeys: [],
    extraSystems: ['Sony PSP'],
  },
  {
    id: 'cemu',
    name: 'Cemu',
    executableNames: ['Cemu.exe'],
    homepage: 'https://cemu.info/',
    args: ['-f', '-g', '{rom}'],
    archives: 'extract',
    runnerKeys: ['cemu'],
    extraSystems: [],
  },
  {
    id: 'ryujinx',
    name: 'Ryujinx',
    executableNames: ['Ryujinx.exe'],
    homepage: 'https://ryujinx.app/',
    args: ['-f', '{rom}'],
    archives: 'extract',
    runnerKeys: ['ryujinx'],
    extraSystems: [],
  },
  {
    id: 'azahar',
    name: 'Azahar',
    executableNames: ['azahar.exe'],
    homepage: 'https://azahar-emu.org/',
    args: ['-f', '{rom}'],
    archives: 'extract',
    runnerKeys: ['azahar'],
    extraSystems: ['Nintendo 3DS'],
  },
  {
    id: 'xemu',
    name: 'xemu',
    executableNames: ['xemu.exe'],
    homepage: 'https://xemu.app/',
    args: ['-full-screen', '-dvd_path', '{rom}'],
    archives: 'extract',
    runnerKeys: ['xemu'],
    extraSystems: [],
  },
  {
    // https://github.com/xenia-canary/xenia-canary/wiki/Options (game path, then options)
    id: 'xenia-canary',
    name: 'Xenia Canary',
    executableNames: ['xenia_canary.exe'],
    homepage: 'https://xenia.jp/',
    args: ['{rom}', '--fullscreen'],
    archives: 'extract',
    runnerKeys: ['xenia_canary'],
    extraSystems: [],
  },
  {
    // https://www.dosbox.com/wiki/Usage (DOSBox Staging accepts the same options)
    id: 'dosbox',
    name: 'DOSBox',
    executableNames: ['dosbox.exe'],
    homepage: 'https://www.dosbox.com/',
    args: ['{rom}', '-fullscreen', '-exit'],
    archives: 'extract',
    runnerKeys: [],
    extraSystems: ['Microsoft DOS'],
  },
  {
    // https://docs.scummvm.org/en/latest/advanced_topics/command_line.html
    id: 'scummvm',
    name: 'ScummVM',
    executableNames: ['scummvm.exe'],
    homepage: 'https://www.scummvm.org/',
    args: ['--fullscreen', '--auto-detect', '--path={romDir}'],
    archives: 'pass',
    runnerKeys: ['scummvm'],
    extraSystems: ['ScummVM'],
  },
  {
    // https://github.com/flyinghead/flycast (the game path is the only argument)
    id: 'flycast',
    name: 'Flycast',
    executableNames: ['flycast.exe'],
    homepage: 'https://github.com/flyinghead/flycast',
    args: ['{rom}'],
    archives: 'pass',
    runnerKeys: [],
    extraSystems: [
      'Sega Dreamcast',
      'Sega Naomi',
      'Sega Naomi GD-ROM',
      'Sega Naomi 2',
      'Sammy Atomiswave',
    ],
  },
  {
    // The runner's HBMAMEEmulatorLauncher, without the paths that are HBMAME's defaults in its
    // own folder (the launch's working folder).
    id: 'hbmame',
    name: 'HBMAME',
    executableNames: ['hbmame.exe', 'hbmame64.exe'],
    homepage: 'https://hbmame.1emulation.com/',
    args: ['-uimodekey', 'DEL', '-skip_gameinfo', '-rompath', '{systemDir}', '{rom}'],
    archives: 'pass',
    runnerKeys: ['hbmame'],
    extraSystems: [],
  },
  {
    // The runner's Openmsx*EmulatorLauncher classes. OPENMSX_HOME keeps openMSX's settings and
    // saves in its own folder (the runner set it for MSX1 only).
    id: 'openmsx',
    name: 'openMSX',
    executableNames: ['openmsx.exe'],
    homepage: 'https://openmsx.org/',
    args: ['-setting', '{emulatorDir}\\share\\settings.xml', '{rom}'],
    archives: 'pass',
    env: { OPENMSX_HOME: '{emulatorDir}' },
    runnerKeys: ['openmsx_msx1', 'openmsx_msx2', 'openmsx_msx2p'],
    variants: {
      openmsx_msx_turbor: {
        suffix: 'turbor',
        name: 'openMSX (Turbo R)',
        args: ['-setting', '{emulatorDir}\\share\\turbor.xml', '{rom}'],
      },
      openmsx_msx_gradiente: {
        suffix: 'gradiente',
        name: 'openMSX (Gradiente Expert)',
        args: ['-machine', 'Gradiente_Expert_GPC-1', '-ext', 'DDX_3.0', '{rom}'],
      },
    },
    extraSystems: [],
  },
  {
    // The runner's ColemEmulatorLauncher (-sgm: the Super Game Module).
    id: 'colem',
    name: 'ColEm',
    executableNames: ['ColEm.exe'],
    homepage: 'https://fms.komkon.org/ColEm/',
    args: ['-sgm', '{rom}'],
    archives: 'pass',
    runnerKeys: ['colem'],
    extraSystems: [],
  },
  {
    // The runner's YapeEmulatorLauncher.
    id: 'yape',
    name: 'YAPE',
    executableNames: ['YapeSDL.exe', 'Yape.exe'],
    homepage: 'http://yape.homeserver.hu/',
    args: ['{rom}'],
    archives: 'pass',
    runnerKeys: ['yape'],
    extraSystems: [],
  },
  {
    // https://github.com/DirtBagXon/hypseus-singe (the runner's HypseusSingeEmulatorLauncher and
    // HypseusEmulatorLauncher, FR-EMU-9). Images are mounted; the game's files are found by name:
    // `<game>.singe` (script), `<game>.zip` (Lua zip), or the system's one shared Lua zip with
    // `-usealt <game>` (hypseus_singe_data 00-zip-roms).
    id: 'hypseus',
    name: 'Hypseus Singe',
    executableNames: ['hypseus.exe'],
    homepage: 'https://github.com/DirtBagXon/hypseus-singe',
    args: [
      'singe',
      'vldp',
      '-framefile',
      '{gameDir}\\{romName}.txt',
      '{entryArgs}',
      '-fullscreen',
      '-opengl',
    ],
    archives: 'pass',
    squashfs: 'mount',
    entries: [
      { file: '{gameDir}\\{romName}.singe', args: ['-script', '{entry}'] },
      { file: '{gameDir}\\{romName}.zip', args: ['-zlua', '{entry}'] },
      { file: '{gameDir}\\*.zip', args: ['-zlua', '{entry}', '-usealt', '{romName}'] },
    ],
    extraArgsLast: true,
    runnerKeys: ['hypseus_singe'],
    variants: {
      hypseus: {
        suffix: 'daphne',
        name: 'Hypseus (Daphne)',
        args: [
          '{romName}',
          'vldp',
          '-framefile',
          '{gameDir}\\{romName}.txt',
          '-fullscreen',
          '-opengl',
          '-fastboot',
          '-force_aspect_ratio',
        ],
        squashfs: 'mount',
        entries: [],
        argsFile: '{gameDir}\\{romName}.commands',
      },
    },
    extraSystems: [],
  },
  {
    // https://learn.microsoft.com/windows-server/administration/windows-commands/cmd — the game
    // is a .bat/.cmd (the runner's `script` systems). `/s` strips one pair of quotes, so the
    // inner pair keeps a name with spaces, & or ( ) whole; spawned with verbatim arguments.
    id: 'script',
    name: 'Script (.bat/.cmd)',
    executableNames: ['cmd.exe'],
    windowsTool: true,
    homepage: 'https://learn.microsoft.com/windows-server/administration/windows-commands/cmd',
    args: ['/d', '/s', '/c', '""{rom}""'],
    cwd: '{romDir}',
    archives: 'pass',
    extraArgsLast: true,
    runnerKeys: ['script'],
    extraSystems: [],
  },
];

/**
 * Per-system catalog changes (NextLevelOS name → change) for systems whose games aren't the
 * extension lists' usual files (FR-EMU-9 Laserdisc and VHS): images, game folders, framefiles,
 * scripts. `scan` keeps support files (docs, `_README.txt`, per-game asset folders) out.
 */
export const SYSTEM_TWEAKS: Readonly<
  Record<string, { extensions?: string[]; scan?: { topLevelOnly?: boolean; ignore?: string[] } }>
> = {
  Daphne: { extensions: ['wsquashfs'] },
  Singe: { extensions: ['wsquashfs', 'hypseus'] },
  'Mattel Captain Power': { extensions: ['txt'], scan: { topLevelOnly: true, ignore: ['_*'] } },
  'Sega Video Driver': { extensions: ['txt'], scan: { topLevelOnly: true, ignore: ['_*'] } },
  'WoW Action Max': { extensions: ['txt'], scan: { topLevelOnly: true, ignore: ['_*'] } },
  'Pioneer LaserActive': { extensions: ['bat'], scan: { topLevelOnly: true } },
  'VM Labs Nuon': { extensions: ['bat'], scan: { topLevelOnly: true } },
};

export interface MameVariant {
  /** Absent for the system's default profile. */
  medium?: string;
  args: string[];
}

// The runner methods' autoboot pairs: profiles drop them and keep the delay (FR-EMU-4).
const AUTOBOOT_2 = ['-autoboot_delay', '2', '-autoboot_command', '%COMMANDS%'];
const AUTOBOOT_4 = ['-autoboot_delay', '4', '-autoboot_command', '%COMMANDS%'];

/** MAME_CUSTOM_ARGS entries that name a runner method: the method's default arguments. */
export const MAME_METHODS: Readonly<Record<string, readonly MameVariant[]>> = {
  'Acorn Electron': [
    {
      args: [
        'electron',
        '-cass',
        '%ROM_PATH%',
        '-autoboot_delay',
        '2',
        '-autoboot_command',
        '*TAPE\\nCHAIN""\\n',
      ],
    },
  ],
  'Exidy Sorcerer': [
    {
      args: [
        'sorcerer',
        '-cass1',
        '%ROM_PATH%',
        '-cart',
        '%SYSTEM_PATH%\\basicpac.zip',
        ...AUTOBOOT_2,
      ],
    },
  ],
  'Fujitsu FM-7': [{ args: ['fm7', '-flop1', '%ROM_PATH%', ...AUTOBOOT_2] }],
  'IBM PC Jr': [{ args: ['ibmpcjr', '-flop', '%ROM_PATH%'] }],
  'Memotech MTX': [{ args: ['mtx512', '-dump', '%ROM_PATH%', ...AUTOBOOT_4] }],
  'NEC PC-8001': [{ args: ['pc8001mk2', '-flop1', '%ROM_PATH%', ...AUTOBOOT_4] }],
  'Sega SC-3000': [
    { args: ['sc3000', '-cart', '%ROM_PATH%'] },
    {
      medium: 'cass',
      args: ['sc3000', '-cart', '%SYSTEM_PATH%\\basic3e.zip', '-cass', '%ROM_PATH%'],
    },
  ],
  'Tandy TRS-80': [
    { args: ['trs80m3', '-cass', '%ROM_PATH%'] },
    {
      medium: 'flop1',
      args: ['trs80m3', '-flop1', '%SYSTEM_PATH%\\MULTIDOS.DSK', '-flop2', '%ROM_PATH%'],
    },
    { medium: 'quik', args: ['trs80m3', '-quik', '%ROM_PATH%'] },
  ],
  'Thomson MO5': [
    {
      args: ['mo5', '-cass', '%ROM_PATH%', '-autoboot_delay', '5', '-autoboot_command', 'RUN""\\n'],
    },
  ],
  'Thomson TO7': [{ args: ['to7', '-cass', '%ROM_PATH%', '-cart', '%SYSTEM_PATH%\\basic.m7'] }],
  'Videoton TV Computer': [
    {
      args: [
        'tvc64',
        '-cass',
        '%ROM_PATH%',
        '-autoboot_delay',
        '5',
        '-autoboot_command',
        'LOAD""\\n',
      ],
    },
    {
      medium: 'flop1',
      args: [
        'tvc64',
        '-exp1',
        'hbf',
        '-flop1',
        '%ROM_PATH%',
        '-autoboot_delay',
        '5',
        '-autoboot_command',
        'LOAD""\\n',
      ],
    },
  ],
};

/** Media for entries with `-%MEDIA%`, default first (the runner took it from each game). */
export const MAME_MEDIA: Readonly<Record<string, readonly string[]>> = {
  'Acorn Atom': ['cass', 'flop1'],
  'Kaypro II': ['flop2'],
  'Mattel Aquarius': ['cart', 'cass'],
  'NEC PC-6001': ['cart1', 'cass'],
  'Tandy TRS-80 Color Computer': ['cart', 'flop1', 'cass'],
};
