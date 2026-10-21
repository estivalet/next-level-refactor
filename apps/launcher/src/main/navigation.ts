function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function withoutHashOrQuery(url: URL): string {
  return `${url.protocol}//${url.host}${url.pathname}`;
}

/**
 * Whether the app window may navigate to `url`: only the renderer's own page (`appPageUrl`, hash
 * and query ignored) or, in development, the dev server. Any other local file — a dropped image or
 * HTML page — is refused, because the preload bridge would be exposed to it.
 */
export function isAllowedNavigation(
  url: string,
  devServerUrl: string | undefined,
  appPageUrl: string,
): boolean {
  const target = parseUrl(url);
  if (!target) return false;
  if (devServerUrl) return target.origin === parseUrl(devServerUrl)?.origin;
  const page = parseUrl(appPageUrl);
  return page !== null && withoutHashOrQuery(target) === withoutHashOrQuery(page);
}

/** Whether `url` may be handed to the system browser (security doc §3 allow-list: https only). */
export function externalUrlAllowed(url: string): boolean {
  return parseUrl(url)?.protocol === 'https:';
}
