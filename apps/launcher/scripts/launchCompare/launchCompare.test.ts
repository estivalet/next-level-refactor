import { describe, expect, it } from 'vitest';
import {
  argDiff,
  classify,
  normalize,
  templated,
  type Built,
  type Placeholders,
} from './compare.ts';
import { brokenParts, oldCommandLine, parseCommandLine, sampleVariants } from './oldCommand.ts';

const built = (exe: string | null, args: string[], extra: Partial<Built> = {}): Built => ({
  exe,
  args,
  cwd: 'C:\\emu',
  env: {},
  error: null,
  ...extra,
});

describe('oldCommandLine', () => {
  const launcher = {
    command:
      '%NEXTLEVEL_RUNNER% -s "Acorn Atom" -r "%romname%" -m "%mame_media%" -x "%launch_args%"',
    rompath: ['%SYSTEMS_BASE_PATH%/Acorn Atom'],
  };

  it('fills the tokens main.cjs fills, from the game', () => {
    const game = { filename: './sub/egghead.zip', mame_media: 'flop1' };
    const line = oldCommandLine(launcher, game, ['e:/a', 'e:/b'], 'RUN', () => false);
    expect(parseCommandLine(line)).toEqual([
      'RUN',
      '-s',
      'Acorn Atom',
      '-r',
      'sub\\egghead.zip',
      '-m',
      'flop1',
      '-x',
      '',
    ]);
  });

  it('uses the first storage path whose system folder has the file', () => {
    const line = oldCommandLine(
      { command: '%SYSTEMS_BASE_PATH%/x.exe', rompath: ['%SYSTEMS_BASE_PATH%/S'] },
      { filename: './g.zip' },
      ['e:/a', 'e:/b'],
      'RUN',
      (path) => path === 'e:/b/S/g.zip',
    );
    expect(line).toBe('e:/b/x.exe');
  });

  it('keeps main.cjs quirks: %romfilename% without a rompath becomes undefined\\…', () => {
    const line = oldCommandLine(
      { command: 'x.exe "%romfilename%"' },
      { filename: './g.zip' },
      [],
      'RUN',
      () => false,
    );
    expect(line).toBe('x.exe "undefined\\.\\g.zip"');
    expect(brokenParts(line)).toEqual(['undefined\\']);
    expect(brokenParts('%RETROARCH_PATH%/r.exe %name%')).toEqual(['%RETROARCH_PATH%', '%name%']);
  });
});

describe('parseCommandLine', () => {
  it('splits outside quotes and keeps empty quoted arguments', () => {
    expect(parseCommandLine('a "b c" "" d')).toEqual(['a', 'b c', '', 'd']);
  });
});

describe('sampleVariants', () => {
  it('keeps the first game of each launch-field combination and counts the rest', () => {
    const variants = sampleVariants([
      { filename: './a', core: 'x' },
      { filename: './b', core: 'x', title: 'ignored' },
      { filename: './c', core: 'y' },
    ]);
    expect(variants.map((v) => [v.game.filename, v.count])).toEqual([
      ['./a', 2],
      ['./c', 1],
    ]);
  });
});

describe('comparison', () => {
  const placeholders: Placeholders = {
    paths: [
      ['E:\\roms\\Atari ST\\Game.st', '{rom}'],
      ['e:\\NextLevel\\systems\\Atari ST\\Game.st', '{rom}'],
      ['E:\\emu\\ra', '{emulatorDir}'],
    ],
    segments: [
      ['Atari ST', '{system}'],
      ['Game', '{romName}'],
    ],
  };

  it('normalizes case, slashes and .\\ segments', () => {
    expect(normalize('E:/A/./B//c\\')).toBe('e:\\a\\b\\c');
  });

  it('replaces paths anywhere and names only as whole path segments', () => {
    expect(templated('e:/emu/ra/config/Atari ST/Game.cfg', placeholders)).toBe(
      '{emulatorDir}\\config\\{system}\\{romName}.cfg',
    );
    expect(templated('Game', placeholders)).toBe('game');
  });

  it('matches the same game on another drive', () => {
    const old = built('e:/emu/ra/retroarch.exe', ['e:\\NextLevel\\systems\\Atari ST\\Game.st']);
    const next = built('E:\\emu\\ra\\retroarch.exe', ['E:\\roms\\Atari ST\\Game.st']);
    expect(classify(old, next, placeholders)).toBe('match');
  });

  it('tells order, argument, program, working folder and error differences apart', () => {
    const exe = 'C:\\emu\\a.exe';
    expect(classify(built(exe, ['-x', '1']), built(exe, ['1', '-x']))).toBe('order');
    expect(classify(built(exe, ['-x']), built(exe, ['-y']))).toBe('args');
    expect(classify(built(exe, ['', '-x']), built(exe, ['-x']))).toBe('match');
    expect(classify(built(exe, []), built('C:\\emu\\b.exe', []))).toBe('emulator');
    expect(classify(built(exe, [], { cwd: 'C:\\' }), built(exe, []))).toBe('cwdOrEnv');
    expect(classify(built(exe, [], { env: { A: '1' } }), built(exe, []))).toBe('cwdOrEnv');
    expect(classify(built(null, [], { error: 'x' }), built(exe, []))).toBe('oldError');
    expect(classify(built(exe, []), built(null, [], { error: 'NO_PROFILE' }))).toBe('newError');
    expect(classify(built(null, []), built(null, []))).toBe('bothError');
  });

  it('lists the arguments only one side passes, as often as they appear', () => {
    const diff = argDiff(['-c', 'e:/emu/ra/x.cfg', '-v', '-v'], ['-v', '-L'], placeholders);
    expect(diff).toEqual({ onlyOld: ['-c', '{emulatorDir}\\x.cfg', '-v'], onlyNew: ['-l'] });
  });
});
