// Ported from NextLevelOS src/themes/big-box/palette.ts @ 3d530b7: the generated menu's top level is
// manufacturers (not NextLevelOS's Arcade/Consoles/… categories), and unknown names still get a
// stable colour from the same set.
interface Accent {
  accent: string;
  accentSoft: string;
}

const accent = (rgb: string, hex: string): Accent => ({
  accent: hex,
  accentSoft: `rgba(${rgb},0.16)`,
});

const NEUTRAL = accent('148,163,184', '#94a3b8');

const TABLE: Record<string, Accent> = {
  Nintendo: accent('248,113,113', '#f87171'),
  Sega: accent('56,189,248', '#38bdf8'),
  Sony: accent('129,140,248', '#818cf8'),
  Microsoft: accent('163,230,53', '#a3e635'),
  Atari: accent('251,146,60', '#fb923c'),
  NEC: accent('45,212,191', '#2dd4bf'),
  SNK: accent('251,191,36', '#fbbf24'),
  Arcade: accent('192,132,252', '#c084fc'),
  Collections: accent('244,114,182', '#f472b6'),
};

const ROTATION = Object.values(TABLE);

/** The accent of a top-level menu item (by its art name); neutral at the root. */
export function accentFor(topLevelName: string | null): Accent {
  if (!topLevelName) return NEUTRAL;
  const known = TABLE[topLevelName];
  if (known) return known;
  let hash = 0;
  for (const char of topLevelName) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return ROTATION[hash % ROTATION.length] ?? NEUTRAL;
}
