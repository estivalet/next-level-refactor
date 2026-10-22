// Cases ported from NextLevelOS src/themes/hyperspin/wheelSettings.test.ts @ 3d530b7: a value
// that falls back is reported in `warnings` (the field name) instead of the console.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WHEEL_SETTINGS,
  parseMenuWheelSettings,
  parseWheelSettings,
} from './wheelSettings.ts';

describe('parseWheelSettings (FR-THM-4)', () => {
  it('defaults reproduce the original wheel', () => {
    expect(DEFAULT_WHEEL_SETTINGS).toEqual({
      width: '34%',
      itemHeight: 96,
      spacing: 1,
      focusScale: 1.12,
      shrink: 0.03,
      minScale: 0.8,
      focusOffset: 0,
      curve: 9,
      padding: [6, 56, 6, 28],
      pointerHeight: 220,
    });
  });

  it('missing input gives the defaults without warnings', () => {
    expect(parseWheelSettings(undefined)).toEqual({ value: DEFAULT_WHEEL_SETTINGS, warnings: [] });
    expect(parseWheelSettings({})).toEqual({ value: DEFAULT_WHEEL_SETTINGS, warnings: [] });
  });

  it('keeps every valid value', () => {
    const wheel = {
      width: '40vw',
      itemHeight: 80,
      spacing: 0.75,
      focusScale: 1.6,
      shrink: 0.05,
      minScale: 0.6,
      focusOffset: 60,
      curve: 14,
      padding: [0, 20, 0, 10],
      pointerHeight: 300,
    };
    expect(parseWheelSettings(wheel)).toEqual({ value: wheel, warnings: [] });
  });

  it('a number written as a string falls back to its default with a warning', () => {
    const { value, warnings } = parseWheelSettings({ itemHeight: '90', spacing: 0.8 });
    expect(value.itemHeight).toBe(96);
    expect(value.spacing).toBe(0.8);
    expect(warnings).toEqual(['itemHeight']);
  });

  it('out-of-range numbers fall back, one warning each', () => {
    const { value, warnings } = parseWheelSettings({
      spacing: 0.1,
      focusScale: 9,
      itemHeight: -5,
      pointerHeight: Number.NaN,
    });
    expect(value).toMatchObject({
      spacing: 1,
      focusScale: 1.12,
      itemHeight: 96,
      pointerHeight: 220,
    });
    expect(warnings).toHaveLength(4);
  });

  it('rejects a bad width string and a padding of the wrong shape', () => {
    const { value, warnings } = parseWheelSettings({ width: 'wide', padding: [1, 2, 3] });
    expect(value.width).toBe('34%');
    expect(value.padding).toEqual([6, 56, 6, 28]);
    expect(warnings).toEqual(['width', 'padding']);
    expect(parseWheelSettings({ padding: [1, 2, 3, -1] }).value.padding).toEqual([6, 56, 6, 28]);
  });

  it('reports an unknown (misspelled) key', () => {
    expect(parseWheelSettings({ focusscale: 2 })).toEqual({
      value: DEFAULT_WHEEL_SETTINGS,
      warnings: ['focusscale'],
    });
  });

  it('a non-object wheel gives the defaults with a warning', () => {
    expect(parseWheelSettings('big')).toEqual({
      value: DEFAULT_WHEEL_SETTINGS,
      warnings: ['wheel'],
    });
  });

  it('never shares the default padding array', () => {
    const { value } = parseWheelSettings({});
    value.padding[0] = 99;
    expect(DEFAULT_WHEEL_SETTINGS.padding[0]).toBe(6);
  });
});

describe('parseMenuWheelSettings (FR-THM-4)', () => {
  it('menuWheel keys override wheel keys; the rest come from wheel', () => {
    const { value } = parseMenuWheelSettings(
      { itemHeight: 110, spacing: 0.8 },
      { itemHeight: 170 },
    );
    expect(value).toMatchObject({ itemHeight: 170, spacing: 0.8, focusScale: 1.12 });
  });

  it('without menuWheel it is the wheel settings', () => {
    expect(parseMenuWheelSettings({ itemHeight: 110 }, undefined)).toEqual(
      parseWheelSettings({ itemHeight: 110 }),
    );
    expect(parseMenuWheelSettings(undefined, undefined).value).toEqual(DEFAULT_WHEEL_SETTINGS);
  });

  it('a non-object menuWheel warns and falls back to wheel', () => {
    const { value, warnings } = parseMenuWheelSettings({ itemHeight: 110 }, 'big');
    expect(value.itemHeight).toBe(110);
    expect(warnings).toEqual(['menuWheel']);
  });

  it('an invalid menuWheel value falls back to the default with a warning naming the key', () => {
    const { value, warnings } = parseMenuWheelSettings({ itemHeight: 110 }, { itemHeight: 'tall' });
    expect(value.itemHeight).toBe(96);
    expect(warnings).toEqual(['itemHeight']);
  });
});
