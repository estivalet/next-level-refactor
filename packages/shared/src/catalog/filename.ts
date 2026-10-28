// Names that come from the catalog API and become paths on the player's disk (Review Focus 2).
// The launcher checks them again before joining paths, so a compromised API can't escape the
// managed folder.

/** A catalog item slug: lowercase words joined by single hyphens, at most 60 characters. */
export const CATALOG_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const CATALOG_SLUG_MAX = 60;

export function safeSlug(slug: string): boolean {
  return slug.length <= CATALOG_SLUG_MAX && CATALOG_SLUG.test(slug);
}

const FORBIDDEN = /[\\/:*?"<>|]/;
// eslint-disable-next-line no-control-regex -- control characters are exactly what is refused
const CONTROL = /[\u0000-\u001f\u007f]/;
/** Windows device names, with or without an extension (`CON`, `nul.txt`, `COM1.nes`). */
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/**
 * A single path segment, 1–200 characters, that Windows accepts as a file name: no separators or
 * `: * ? " < > |`, no control characters, not `.`/`..`, no trailing dot or space, not a device
 * name. With `extensions`, its extension must be one of them (case-insensitive).
 */
export function safeFilename(name: string, extensions?: readonly string[]): boolean {
  if (name.length < 1 || name.length > 200) return false;
  if (FORBIDDEN.test(name) || CONTROL.test(name)) return false;
  if (name === '.' || name === '..' || name.endsWith('.') || name.endsWith(' ')) return false;
  if (RESERVED.test(name)) return false;
  if (extensions === undefined) return true;
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return false;
  const extension = name.slice(dot + 1).toLowerCase();
  return extensions.some((allowed) => allowed.toLowerCase() === extension);
}
