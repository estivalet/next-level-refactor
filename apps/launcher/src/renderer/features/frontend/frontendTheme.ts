import type { Settings } from '@nextlevel/shared';
import { resolveTheme } from '@nextlevel/themes';

/** The theme the front-end shows: the last one used, else the default; unknown ids → Big Box. */
export function frontendThemeId(settings: Settings): string {
  return resolveTheme(settings.themes.lastUsed ?? settings.themes.activeDefault).id;
}
