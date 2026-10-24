// ScreenScraper puts every credential in the query string, and fetch errors quote the URL.
// Ported from NextLevelOS scrappers/ScreenScraper.py (redact) @ 3d530b7.
const SECRET_PARAM = /(devid|devpassword|ssid|sspassword)=[^&\s]*/g;

/** The text with every credential value replaced by `***` (FR-SCR-3). */
export function redact(value: unknown): string {
  return String(value).replace(SECRET_PARAM, '$1=***');
}
