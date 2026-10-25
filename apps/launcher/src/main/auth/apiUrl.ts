const DEFAULT_API_URL = 'http://localhost:4000';

/**
 * The API the launcher talks to: fixed per build (`MAIN_VITE_API_URL`); development builds also
 * honour `NEXTLEVEL_API_URL` (e2e points it at a test API). No trailing slash.
 */
export function apiBaseUrl(opts: {
  isPackaged: boolean;
  override: string | undefined;
  built: string | undefined;
}): string {
  const chosen = (!opts.isPackaged && opts.override) || opts.built || DEFAULT_API_URL;
  return chosen.replace(/\/+$/, '');
}
