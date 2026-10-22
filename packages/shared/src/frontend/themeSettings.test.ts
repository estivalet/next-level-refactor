import { describe, expect, it } from 'vitest';
import {
  HYPERSPIN_WHEEL_RANGES,
  THEME_SETTINGS_SCHEMAS,
  themeSettingsSchema,
  WheelOptionsSchema,
} from './themeSettings.ts';

const paths = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.success ? [] : (result.error?.issues ?? []).map((issue) => issue.path.join('.'));

describe('per-theme settings schemas (FR-THM-4)', () => {
  it('HyperSpin and Showcase have options; the other themes have none', () => {
    expect(Object.keys(THEME_SETTINGS_SCHEMAS).sort()).toEqual(['hyperspin', 'showcase']);
    expect(themeSettingsSchema('big-box')).toBeUndefined();
    expect(themeSettingsSchema('hyperspin')).toBe(THEME_SETTINGS_SCHEMAS['hyperspin']);
  });

  it('filtersInMenu must be a boolean', () => {
    const showcase = themeSettingsSchema('showcase');
    expect(showcase?.safeParse({ filtersInMenu: false }).success).toBe(true);
    expect(paths(showcase?.safeParse({ filtersInMenu: 'no' }) ?? { success: true })).toEqual([
      'filtersInMenu',
    ]);
  });

  it('wheel keys follow the documented ranges, every key optional', () => {
    expect(WheelOptionsSchema.safeParse({}).success).toBe(true);
    expect(
      WheelOptionsSchema.safeParse({
        width: '40vw',
        itemHeight: 24,
        spacing: 2,
        padding: [0, 400, 0, 10],
        pointerHeight: 1200,
      }).success,
    ).toBe(true);
    expect(
      paths(
        WheelOptionsSchema.safeParse({
          width: 'wide',
          itemHeight: 401,
          curve: 0,
          padding: [1, 2, 3],
          focusScale: '1.2',
        }),
      ).sort(),
    ).toEqual(['curve', 'focusScale', 'itemHeight', 'padding', 'width']);
  });

  it('the ranges match the HyperSpin guide', () => {
    expect(HYPERSPIN_WHEEL_RANGES).toEqual({
      itemHeight: [24, 400],
      spacing: [0.3, 2],
      focusScale: [0.5, 3],
      shrink: [0, 0.5],
      minScale: [0.1, 1],
      focusOffset: [-400, 400],
      curve: [1, 100],
      pointerHeight: [16, 1200],
    });
  });

  it('HyperSpin validates wheel and menuWheel', () => {
    const hyperspin = themeSettingsSchema('hyperspin');
    expect(
      paths(
        hyperspin?.safeParse({ wheel: { itemHeight: 10 }, menuWheel: { spacing: 9 } }) ?? {
          success: true,
        },
      ),
    ).toEqual(['wheel.itemHeight', 'menuWheel.spacing']);
  });
});
