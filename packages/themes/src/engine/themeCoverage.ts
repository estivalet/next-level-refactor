// Ported from NextLevelOS src/themes/engine/themeCoverage.ts @ 3d530b7.
import type { MenuNode } from '@nextlevel/shared';
import { WALLPAPER_FOLDER } from './themeArt.ts';
import type { ThemeArtConfig } from './types.ts';

export type CoverageSlot = 'logo' | 'background' | 'video' | 'wallpaper';

/** Slots shown in the panel but left out of `percent`: a pack is complete without them. */
export const OPTIONAL_COVERAGE_SLOTS: readonly CoverageSlot[] = ['wallpaper'];

export interface SlotCoverage {
  have: number;
  total: number;
  /** Menu item names the pack has no file for, in menu order. */
  missing: string[];
}

export interface ThemeCoverage {
  slots: Record<CoverageSlot, SlotCoverage>;
  /** Files present over files counted, across counted required slots, rounded; 0 when none. */
  percent: number;
}

/** Every menu node name (categories, systems, filters), depth-first, de-duplicated. */
export function collectMenuNames(items: readonly MenuNode[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const walk = (list: readonly MenuNode[]) => {
    for (const item of list) {
      if (!seen.has(item.name)) {
        seen.add(item.name);
        out.push(item.name);
      }
      walk(item.children);
    }
  };
  walk(items);
  return out;
}

/**
 * How much of the theme's menu-level art the pack supplies itself. Paths are
 * compared case-insensitively because the Windows file system that serves
 * the art ignores case.
 */
export function computeCoverage(
  names: string[],
  art: ThemeArtConfig,
  packFiles: string[],
): ThemeCoverage {
  const files = new Set(packFiles.map((f) => f.replace(/\\/g, '/').toLowerCase()));
  const has = (p: string) => files.has(p.toLowerCase());

  const slot = (counted: boolean, present: (name: string) => boolean): SlotCoverage => {
    if (!counted) return { have: 0, total: 0, missing: [] };
    const missing = names.filter((n) => !present(n));
    return { have: names.length - missing.length, total: names.length, missing };
  };

  const slots: Record<CoverageSlot, SlotCoverage> = {
    logo: slot(true, (n) => has(`logo/${art.logoVariant}/${n}.png`)),
    background: slot(true, (n) =>
      art.backgroundVariants.some((v) => has(`${v}/${n}.jpg`) || has(`${v}/${n}.png`)),
    ),
    video: slot(art.useVideoBackground, (n) => has(`video/${n}.mp4`)),
    wallpaper: slot(
      true,
      (n) => has(`${WALLPAPER_FOLDER}/${n}.jpg`) || has(`${WALLPAPER_FOLDER}/${n}.png`),
    ),
  };

  const all = (Object.keys(slots) as CoverageSlot[])
    .filter((s) => !OPTIONAL_COVERAGE_SLOTS.includes(s))
    .map((s) => slots[s]);
  const total = all.reduce((sum, s) => sum + s.total, 0);
  const have = all.reduce((sum, s) => sum + s.have, 0);
  return { slots, percent: total ? Math.round((have * 100) / total) : 0 };
}
