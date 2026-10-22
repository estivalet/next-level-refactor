import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, SettingsSchema, defaultSettings } from './schema.ts';
import { INPUT_ACTIONS, bindingLabel, normalizePadBinding } from './input.ts';

function issuesOf(input: unknown) {
  const result = SettingsSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => [i.path.join('.'), i.message]);
}

describe('input settings', () => {
  it('US-C1: defaults match the gamepad layout and repeat timing', () => {
    const { input } = defaultSettings();
    expect(input.gamepad.select).toEqual(['a']);
    expect(input.gamepad.back).toEqual(['b']);
    expect(input.gamepad.menu).toEqual(['start']);
    expect(input.gamepad.favorite).toEqual(['y']);
    expect(input.gamepad.tabPrev).toEqual(['lb']);
    expect(input.gamepad.tabNext).toEqual(['rb']);
    expect(input.gamepad.down).toEqual(['dpadDown', 'lsDown']);
    expect(input.gamepad.toDesktop).toEqual(['view+start']);
    expect(input.keyboard.select).toEqual(['Enter']);
    expect(input.keyboard.back).toEqual(['Escape', 'Backspace']);
    expect(input.repeatDelayMs).toBe(400);
    expect(input.repeatRateHz).toBe(10);
    expect(Object.keys(input.keyboard)).toEqual([...INPUT_ACTIONS]);
  });

  it('FR-THM-3: a partial map keeps the user bindings and fills the other actions', () => {
    const parsed = SettingsSchema.parse({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      input: { keyboard: { random: ['KeyG'] }, repeatDelayMs: 300 },
    });
    expect(parsed.input.keyboard.random).toEqual(['KeyG']);
    expect(parsed.input.keyboard.favorite).toEqual(['KeyX']);
    expect(parsed.input.repeatDelayMs).toBe(300);
  });

  it('FR-THM-3: the same key on two actions is a duplicateBinding on the later one', () => {
    const input = { keyboard: { favorite: ['KeyX'], hide: ['KeyH', 'KeyX'] } };
    expect(issuesOf({ schemaVersion: 1, input })).toEqual([
      ['input.keyboard.hide.1', 'duplicateBinding'],
    ]);
  });

  it('FR-THM-3: chords are compared regardless of button order', () => {
    const input = { gamepad: { switchTheme: ['start+view'] } };
    expect(issuesOf({ schemaVersion: 1, input })).toEqual([
      ['input.gamepad.switchTheme.0', 'duplicateBinding'],
    ]);
    expect(normalizePadBinding('start+view')).toBe('view+start');
  });

  it('FR-THM-3: bad buttons, three-button chords and out-of-range timing fail', () => {
    expect(issuesOf({ schemaVersion: 1, input: { gamepad: { random: ['z'] } } })).not.toEqual([]);
    expect(issuesOf({ schemaVersion: 1, input: { gamepad: { random: ['a+b+x'] } } })).not.toEqual(
      [],
    );
    expect(issuesOf({ schemaVersion: 1, input: { gamepad: { random: ['a+a'] } } })).not.toEqual([]);
    expect(issuesOf({ schemaVersion: 1, input: { repeatRateHz: 0 } })).not.toEqual([]);
    expect(issuesOf({ schemaVersion: 1, input: { repeatDelayMs: 2000 } })).not.toEqual([]);
  });
});

describe('art folders', () => {
  it('FR-THM-2: art and theme pack folders default to null and must be absolute', () => {
    expect(defaultSettings().storage).toMatchObject({ assetsPath: null, themesPath: null });
    const storage = { assetsPath: 'art', themesPath: 'E:\\NextLevel\\themes' };
    expect(issuesOf({ schemaVersion: 1, storage })).toEqual([
      ['storage.assetsPath', 'notAbsolute'],
    ]);
  });
});

describe('bindingLabel', () => {
  it('FR-THM-3: keys and buttons get short readable labels', () => {
    expect(bindingLabel('keyboard', 'KeyF')).toBe('F');
    expect(bindingLabel('keyboard', 'Digit1')).toBe('1');
    expect(bindingLabel('keyboard', 'ArrowUp')).toBe('↑');
    expect(bindingLabel('keyboard', 'Escape')).toBe('Esc');
    expect(bindingLabel('keyboard', 'Slash')).toBe('/');
    expect(bindingLabel('keyboard', 'PageDown')).toBe('PageDown');
    expect(bindingLabel('gamepad', 'a')).toBe('A');
    expect(bindingLabel('gamepad', 'lb')).toBe('LB');
    expect(bindingLabel('gamepad', 'view+start')).toBe('View + Start');
    expect(bindingLabel('gamepad', 'dpadUp')).toBe('D-pad ↑');
    expect(bindingLabel('gamepad', 'lsLeft')).toBe('L-stick ←');
    expect(bindingLabel('gamepad', 'ls')).toBe('L3');
  });
});
