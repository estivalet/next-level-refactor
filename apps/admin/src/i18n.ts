import adminEn from '@nextlevel/shared/i18n/admin.en.json';
import adminPtBR from '@nextlevel/shared/i18n/admin.pt-BR.json';
import en from '@nextlevel/shared/i18n/en.json';
import ptBR from '@nextlevel/shared/i18n/pt-BR.json';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

/** The console's languages (D27): pt* browsers get pt-BR, everyone else English. */
export const LANGUAGES = ['en', 'pt-BR'] as const;
const initial = navigator.language.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';

// The launcher's strings come along for `errors.*`; the console's own live under `admin.*`.
void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: { ...en, ...adminEn } },
    'pt-BR': { translation: { ...ptBR, ...adminPtBR } },
  },
  lng: initial,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
