/**
 * An "Essentials" collection (D63): named "Essentials" or "<anything> Essentials", case-insensitive —
 * the per-system top-games lists NextLevelOS builds ("Nintendo SNES Essentials") — also when the
 * import renamed it on a name clash ("SNES Essentials (NextLevelOS 2)"). The SQL twin is
 * ESSENTIALS_SQL in the launcher's gameSql.ts.
 */
export function isEssentialsName(name: string): boolean {
  return /^(?:.* )?essentials(?: \(nextlevelos(?: [1-9].*)?\))?$/.test(name.trim().toLowerCase());
}
