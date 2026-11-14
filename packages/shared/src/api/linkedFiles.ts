import { z } from 'zod';

// Linked catalog files (FR-CAT-9, D65, ADR-015): a catalog file can be a link to a copy on Google
// Drive or archive.org. The API verifies it once (size, SHA-256) and the launcher downloads it
// straight from the host.

export const LINK_HOSTS = ['drive', 'archive'] as const;
export type LinkHost = (typeof LINK_HOSTS)[number];

/** Why a link isn't (or is no longer) a usable file. */
export const LINK_ERRORS = [
  'linkHost',
  'linkFile',
  'linkStatus',
  'linkNotFile',
  'linkNetwork',
  'tooLarge',
] as const;
export type LinkError = (typeof LINK_ERRORS)[number];

export const LinkHostSchema = z.enum(LINK_HOSTS);
export const LinkErrorSchema = z.enum(LINK_ERRORS);

export type NormalizedLink =
  { ok: true; host: LinkHost; url: string } | { ok: false; reason: 'linkHost' | 'linkFile' };

const DRIVE_ID = /^[A-Za-z0-9_-]{1,200}$/;

function parse(input: string): URL | null {
  try {
    const url = new URL(input.trim());
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function driveId(url: URL): string | null {
  const path = /^\/file\/d\/([^/]+)/.exec(url.pathname);
  const id = path
    ? path[1]
    : ['/open', '/uc'].includes(url.pathname)
      ? url.searchParams.get('id')
      : null;
  return id && DRIVE_ID.test(id) ? id : null;
}

/**
 * A share link as the direct download link the API verifies and the launcher downloads: Drive
 * file links (`/file/d/<id>`, `/open?id=`, `/uc?id=`) and archive.org `/details/` or
 * `/download/` links that name a file. Anything else is refused.
 */
export function normalizeLink(input: string): NormalizedLink {
  const url = parse(input);
  if (!url) return { ok: false, reason: 'linkHost' };
  if (url.hostname === 'drive.google.com') {
    const id = driveId(url);
    if (!id) return { ok: false, reason: 'linkFile' };
    return {
      ok: true,
      host: 'drive',
      url: `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`,
    };
  }
  if (url.hostname === 'archive.org' || url.hostname === 'www.archive.org') {
    const match = /^\/(?:details|download)\/([^/]+)\/(.+)$/.exec(url.pathname);
    if (!match) return { ok: false, reason: 'linkFile' };
    return {
      ok: true,
      host: 'archive',
      url: `https://archive.org/download/${match[1] ?? ''}/${match[2] ?? ''}`,
    };
  }
  return { ok: false, reason: 'linkHost' };
}

const within = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/** A host a linked file may be served from after redirects (https only). */
export function isLinkHost(link: string): boolean {
  const url = parse(link);
  if (!url) return false;
  const host = url.hostname.toLowerCase();
  return (
    host === 'drive.google.com' ||
    host === 'drive.usercontent.google.com' ||
    within(host, 'googleusercontent.com') ||
    within(host, 'archive.org')
  );
}
