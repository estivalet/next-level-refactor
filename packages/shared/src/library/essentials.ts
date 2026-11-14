/**
 * An "Essentials" collection (D63): named "Essentials" or "<anything> Essentials", case-insensitive —
 * the per-system top-games lists NextLevelOS builds ("Nintendo SNES Essentials").
 */
export function isEssentialsName(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return lower === 'essentials' || lower.endsWith(' essentials');
}
