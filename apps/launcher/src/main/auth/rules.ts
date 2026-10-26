import type { Entitlement } from '@nextlevel/shared';

const CLOCK_SLACK_MS = 5 * 60_000;

/**
 * Whether the launcher may run on its cached entitlement (FR-AUTH-5, US-A3). The grace length
 * comes from the server (`offlineUntil − checkedAt`) and is counted on this PC's clock from the
 * last successful check, so a wrong PC clock neither shortens nor stretches it. A clock set back
 * more than 5 minutes before that check counts as expired.
 */
export function offlineAllowed(
  record: { localCheckedAt: string; entitlement: Entitlement },
  now: Date,
): boolean {
  const start = Date.parse(record.localCheckedAt);
  const grace =
    Date.parse(record.entitlement.offlineUntil) - Date.parse(record.entitlement.checkedAt);
  const at = now.getTime();
  return at >= start - CLOCK_SLACK_MS && at < start + grace;
}

const GOOGLE_AUTHORIZE = 'https://accounts.google.com/';

/** The browser is only sent to Google's consent page or to the API itself (the dev stub). */
export function authorizeUrlAllowed(url: string, apiOrigin: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return url.startsWith(GOOGLE_AUTHORIZE) || parsed.origin === new URL(apiOrigin).origin;
}
