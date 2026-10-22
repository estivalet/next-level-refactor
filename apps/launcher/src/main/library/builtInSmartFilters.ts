import type { Settings } from '@nextlevel/shared';
import { mainText } from '../i18n/mainText.ts';
import type { BuiltInNames, SmartFilterRepository } from './SmartFilterRepository.ts';

type Language = Settings['general']['language'];

/** Favorites, Recently played and Most played in the UI language (D10). */
export function builtInNames(language: Language): BuiltInNames {
  return {
    favorites: mainText(language, 'library.smart.builtin.favorites'),
    recent: mainText(language, 'library.smart.builtin.recent'),
    mostPlayed: mainText(language, 'library.smart.builtin.mostPlayed'),
  };
}

/** Run at every start; the repository creates them only the first time. */
export function seedBuiltInSmartFilters(repo: SmartFilterRepository, language: Language): void {
  repo.seedBuiltIns(builtInNames(language));
}
