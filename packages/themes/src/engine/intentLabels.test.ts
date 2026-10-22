// Cases ported from NextLevelOS src/themes/engine/intentLabels.test.ts @ 3d530b7.
import { defaultSettings } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { describeKeymap, intentLabelKey } from './intentLabels.ts';
import type { KeyMap } from './types.ts';

const KEYMAP: KeyMap = {
  left: 'focus-prev',
  right: 'focus-next',
  up: 'enter',
  select: 'enter',
  back: 'back',
  search: 'toggle-search',
};
const input = defaultSettings().input;

describe('describeKeymap (FR-THM-3)', () => {
  it('lists each intent once with the user keys and buttons of every action bound to it', () => {
    const rows = describeKeymap(KEYMAP, input);
    expect(rows[0]).toEqual({
      intent: 'focus-prev',
      labelKey: 'themes.intents.focus-prev',
      keys: ['←'],
      buttons: ['D-pad ←', 'L-stick ←'],
    });
    expect(rows.find((row) => row.intent === 'enter')).toMatchObject({
      keys: ['↑', 'Enter'],
      buttons: ['D-pad ↑', 'L-stick ↑', 'A'],
    });
    expect(rows.find((row) => row.intent === 'back')?.keys).toEqual(['Esc', 'Backspace']);
  });

  it('follows remapped bindings', () => {
    const remapped = { ...input, keyboard: { ...input.keyboard, search: ['KeyS'] } };
    expect(
      describeKeymap(KEYMAP, remapped).find((r) => r.intent === 'toggle-search')?.keys,
    ).toEqual(['S']);
  });

  it('filters and orders by the given intents', () => {
    expect(describeKeymap(KEYMAP, input, ['back', 'enter']).map((row) => row.intent)).toEqual([
      'back',
      'enter',
    ]);
  });

  it('labels intents through i18n keys', () => {
    expect(intentLabelKey('random')).toBe('themes.intents.random');
  });
});
