function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** Whether the app window may navigate to `url`: only the app's own files or the dev server. */
export function isAllowedNavigation(url: string, devServerUrl: string | undefined): boolean {
  const target = parseUrl(url);
  if (!target) return false;
  if (target.protocol === 'file:') return true;
  if (!devServerUrl) return false;
  return target.origin === parseUrl(devServerUrl)?.origin;
}

/** Whether `url` may be handed to the system browser (security doc §3 allow-list: https only). */
export function externalUrlAllowed(url: string): boolean {
  return parseUrl(url)?.protocol === 'https:';
}
