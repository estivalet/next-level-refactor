/**
 * Turns what the user typed into an FTS5 query (FR-LIB-10): every run of letters or digits becomes
 * a quoted prefix term, all of which must match. Quoting means no character the user types can be
 * FTS syntax. Returns null for text under 2 characters or without letters and digits.
 */
export function ftsQuery(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length < 2) return null;
  const tokens = trimmed.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (tokens.length === 0) return null;
  return tokens.map((token) => `"${token}"*`).join(' ');
}

/** A LIKE pattern for titles that start with the text, with LIKE's wildcards escaped by `\`. */
export function titlePrefixPattern(text: string): string {
  return `${text
    .trim()
    .toLowerCase()
    .replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
