import en from '@nextlevel/shared/i18n/en.json';
import ptBR from '@nextlevel/shared/i18n/pt-BR.json';
import type { Settings } from '@nextlevel/shared';

type Language = Settings['general']['language'];

const RESOURCES: Record<Language, unknown> = { en, 'pt-BR': ptBR };

function lookup(resource: unknown, key: string): string | undefined {
  let node = resource;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * A UI string for text main writes into user data (generated menu labels, built-in smart filter
 * names): the language's value, then English, then the key itself.
 */
export function mainText(language: Language, key: string): string {
  return lookup(RESOURCES[language], key) ?? lookup(en, key) ?? key;
}
