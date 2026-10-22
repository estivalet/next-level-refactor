import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMameArgs, parseSystemEmulators } from './runner.ts';

const source = readFileSync(join(import.meta.dirname, 'fixtures', 'runner.py'), 'utf8');

describe('runner parsing (FR-EMU-7 seed)', () => {
  it('reads each system’s emulators in order', () => {
    expect(parseSystemEmulators(source)).toEqual({
      'Nintendo 64': ['retroarch'],
      'Apple II': ['mame', 'retroarch'],
      'Nintendo GameCube': ['dolphin'],
      'Tandy TRS-80': ['mame'],
      'Acorn Atom': ['mame'],
      'Sega Model 2': ['model2'],
    });
  });

  it('reads MAME argument lists and method names, skipping comments', () => {
    const args = parseMameArgs(source);
    expect(args['Apple II']).toEqual(['apple2ee', '-gameio', 'joy', '-flop1', '%ROM_PATH%']);
    expect(args['Tandy TRS-80']).toEqual({ method: 'trs80_args' });
    expect(args['Kaypro II']).toEqual([
      'kayproii',
      '-flop1',
      '%SYSTEM_PATH%\\cpm22.zip',
      '-%MEDIA%',
      '%ROM_PATH%',
    ]);
  });

  it('decodes Python escapes: \\\\n stays a literal backslash-n for MAME', () => {
    expect((parseMameArgs(source)['Sharp MZ-700'] as string[]).at(-1)).toBe('LOAD\\n');
  });
});
