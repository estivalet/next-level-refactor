import { defaultSettings } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { keyboardActions, passesTextInput } from './keyboard.ts';

const input = defaultSettings().input;

describe('keyboardActions (FR-THM-3)', () => {
  it('maps a key code to every action bound to it', () => {
    expect(keyboardActions('KeyX', input)).toEqual(['favorite']);
    expect(keyboardActions('Escape', input)).toEqual(['back']);
    expect(keyboardActions('KeyZ', input)).toEqual([]);
  });

  it('follows remapped keys', () => {
    const remapped = { ...input, keyboard: { ...input.keyboard, favorite: ['KeyV'] } };
    expect(keyboardActions('KeyV', remapped)).toEqual(['favorite']);
    expect(keyboardActions('KeyX', remapped)).toEqual([]);
  });
});

describe('passesTextInput (FR-THM-3)', () => {
  it('only Escape, Enter and the arrows leave a text field', () => {
    expect(passesTextInput('Escape')).toBe(true);
    expect(passesTextInput('Enter')).toBe(true);
    expect(passesTextInput('ArrowDown')).toBe(true);
    expect(passesTextInput('KeyF')).toBe(false);
    expect(passesTextInput('Backspace')).toBe(false);
  });
});
