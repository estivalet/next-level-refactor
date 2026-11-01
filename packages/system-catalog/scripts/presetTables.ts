// Hand-written preset data the runner can't provide as plain tables. Arguments are in the runner's
// placeholder form (%ROM_PATH%, %SYSTEM_PATH%) and go through mameProfileArgs like parsed ones.

export interface StandaloneSpec {
  id: string;
  name: string;
  executableNames: string[];
  homepage: string;
  args: string[];
  archives: 'pass' | 'extract';
  /** Runner emulator keys (SYSTEM_EMULATORS values) this preset replaces. */
  runnerKeys: string[];
  /** NextLevelOS system names to add after the runner's choices. */
  extraSystems: string[];
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
];

export interface MameVariant {
  /** Absent for the system's default profile. */
  medium?: string;
  args: string[];
}

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
    { args: ['sorcerer', '-cass1', '%ROM_PATH%', '-cart', '%SYSTEM_PATH%\\basicpac.zip'] },
  ],
  'Fujitsu FM-7': [{ args: ['fm7', '-flop1', '%ROM_PATH%'] }],
  'IBM PC Jr': [{ args: ['ibmpcjr', '-flop', '%ROM_PATH%'] }],
  'Memotech MTX': [{ args: ['mtx512', '-dump', '%ROM_PATH%'] }],
  'NEC PC-8001': [{ args: ['pc8001mk2', '-flop1', '%ROM_PATH%'] }],
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
