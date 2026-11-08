/** Sorting, search and labels for the Emulators page's two panes (FR-EMU-2). */

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** A–Z by name, ignoring case and accents; "9" before "10". */
export function byName(a: { name: string }, b: { name: string }): number {
  return collator.compare(a.name, b.name);
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Whether `name` contains the typed `query` (case and accents ignored); empty matches all. */
export function matchesSearch(name: string, query: string): boolean {
  return fold(name).includes(fold(query));
}

/**
 * A profile's name as shown under its emulator: "MAME – Jupiter Ace" → "Jupiter Ace". Names
 * that are only the emulator's name, or don't start with "<emulator> <dash or colon>", stay.
 */
export function profileLabel(profileName: string, emulatorName: string): string {
  const prefix = emulatorName.trim();
  if (fold(profileName.slice(0, prefix.length)) !== fold(prefix)) return profileName;
  const rest = /^\s*[-–—:]\s*(.+)$/.exec(profileName.slice(prefix.length));
  return rest?.[1] ?? profileName;
}

/** Whether the emulator at `emulatorIndex`, or one of its profiles, has a validation error. */
export function needsAttention(
  errors: Readonly<Record<string, string>>,
  emulatorIndex: number,
  profileIndices: readonly number[],
): boolean {
  const prefixes = [
    `emulators.${String(emulatorIndex)}.`,
    ...profileIndices.map((index) => `profiles.${String(index)}.`),
  ];
  return Object.keys(errors).some((path) => prefixes.some((prefix) => path.startsWith(prefix)));
}
