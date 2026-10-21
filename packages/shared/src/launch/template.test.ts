import { describe, expect, it } from 'vitest';
import {
  formatCommandLine,
  renderArgs,
  renderValue,
  TEMPLATE_TOKENS,
  templateIssues,
  usesToken,
  type TokenContext,
} from './template.ts';

const ctx: TokenContext = {
  rom: 'E:\\r\\A (USA).zip',
  romDir: 'E:\\r',
  romName: 'A (USA)',
  romFile: 'A (USA).zip',
  romExt: 'zip',
  systemId: 'nintendo-64',
  systemDir: 'E:\\r',
  emulatorDir: 'E:\\emu\\ra',
  core: 'x',
  extraArgs: [],
};

describe('launch template (FR-EMU-3)', () => {
  it('FR-EMU-3: the token set is fixed', () => {
    expect([...TEMPLATE_TOKENS]).toEqual([
      'rom',
      'romDir',
      'romName',
      'romFile',
      'romExt',
      'systemId',
      'systemDir',
      'emulatorDir',
      'core',
      'extraArgs',
    ]);
  });

  it('US-D1: an unknown token is reported with its name and position', () => {
    expect(templateIssues('{romm}', 'arg')).toEqual([
      { message: 'unknownToken', token: 'romm', index: 0 },
    ]);
    expect(templateIssues('-x {rom} {nope}', 'arg')).toEqual([
      { message: 'unknownToken', token: 'nope', index: 9 },
    ]);
  });

  it('FR-EMU-3: valid templates have no issues', () => {
    expect(templateIssues('{emulatorDir}/cores/{core}.dll', 'arg')).toEqual([]);
    expect(templateIssues('{extraArgs}', 'arg')).toEqual([]);
    expect(templateIssues('plain', 'value')).toEqual([]);
  });

  it('FR-EMU-3: an unclosed brace is an issue', () => {
    expect(templateIssues('{rom', 'arg')).toEqual([{ message: 'unclosedBrace', index: 0 }]);
    expect(templateIssues('a}b', 'arg')).toEqual([{ message: 'unclosedBrace', index: 1 }]);
  });

  it('FR-EMU-3: {extraArgs} must be a whole argument, and is never allowed in values', () => {
    expect(templateIssues('-x{extraArgs}', 'arg')).toEqual([
      { message: 'extraArgsAlone', token: 'extraArgs', index: 2 },
    ]);
    expect(templateIssues('{extraArgs}', 'value')).toEqual([
      { message: 'extraArgsAlone', token: 'extraArgs', index: 0 },
    ]);
  });

  it('FR-EMU-3: doubled braces are literal', () => {
    expect(templateIssues('{{rom}}', 'arg')).toEqual([]);
    expect(renderValue('{{rom}}', ctx)).toBe('{rom}');
    expect(renderValue('a{{b', ctx)).toBe('a{b');
  });

  it('FR-EMU-3: renders an argv array; {extraArgs} expands to zero or more elements', () => {
    const args = ['-L', '{emulatorDir}/cores/{core}.dll', '{extraArgs}', '{rom}'];
    expect(renderArgs(args, { ...ctx, extraArgs: ['--a', 'b c'] })).toEqual([
      '-L',
      'E:\\emu\\ra/cores/x.dll',
      '--a',
      'b c',
      'E:\\r\\A (USA).zip',
    ]);
    expect(renderArgs(args, ctx)).toEqual(['-L', 'E:\\emu\\ra/cores/x.dll', 'E:\\r\\A (USA).zip']);
  });

  it('ADR-004: a value with spaces and shell characters stays one element', () => {
    const rom = 'E:\\r\\Pokémon & Friends (USA) [!] 100%.zip';
    expect(renderArgs(['--exec={rom}'], { ...ctx, rom })).toEqual([`--exec=${rom}`]);
  });

  it('renders every token', () => {
    expect(
      renderValue('{rom}|{romDir}|{romName}|{romFile}|{romExt}|{systemId}|{systemDir}|{core}', ctx),
    ).toBe('E:\\r\\A (USA).zip|E:\\r|A (USA)|A (USA).zip|zip|nintendo-64|E:\\r|x');
  });

  it('formats a command line for display with Windows quoting', () => {
    expect(formatCommandLine('C:\\Emu\\x.exe', ['-a', 'b c', 'a"b', ''])).toBe(
      'C:\\Emu\\x.exe -a "b c" "a\\"b" ""',
    );
    expect(formatCommandLine('C:\\Program Files\\x.exe', ['C:\\d\\'])).toBe(
      '"C:\\Program Files\\x.exe" C:\\d\\',
    );
    expect(formatCommandLine('x.exe', ['C:\\my dir\\'])).toBe('x.exe "C:\\my dir\\\\"');
  });

  it('usesToken finds a token but not a literal one', () => {
    expect(usesToken('{emulatorDir}/cores/{core}.dll', 'core')).toBe(true);
    expect(usesToken('{{core}}', 'core')).toBe(false);
    expect(usesToken('{rom}', 'core')).toBe(false);
  });
});
