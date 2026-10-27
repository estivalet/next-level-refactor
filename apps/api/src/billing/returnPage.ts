import en from '@nextlevel/shared/i18n/en.json' with { type: 'json' };
import ptBR from '@nextlevel/shared/i18n/pt-BR.json' with { type: 'json' };

// The page Stripe Checkout and the Portal return to (IA F7): the launcher is polling the
// entitlement, so the browser tab only has to say "go back to NextLevel".

export const RETURN_RESULTS = ['success', 'cancelled', 'portal'] as const;
export type ReturnResult = (typeof RETURN_RESULTS)[number];

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${String(c.charCodeAt(0))};`);

/** pt-BR when the browser prefers Portuguese, else English. */
export function localeOf(acceptLanguage: string | undefined): 'en' | 'pt-BR' {
  const first = acceptLanguage?.split(',')[0]?.trim().toLowerCase() ?? '';
  return first.startsWith('pt') ? 'pt-BR' : 'en';
}

export function returnPage(result: ReturnResult, locale: 'en' | 'pt-BR'): string {
  const strings = (locale === 'pt-BR' ? ptBR : en).billingReturn;
  const { title, body } = strings[result];
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NextLevel</title>
<style>
  body { font-family: system-ui, sans-serif; background: #111318; color: #e8e9ee; margin: 0;
    min-height: 100vh; display: grid; place-items: center; }
  main { max-width: 32rem; padding: 2rem; text-align: center; }
  h1 { font-size: 1.5rem; }
</style>
</head>
<body>
<main>
<h1>${escape(title)}</h1>
<p>${escape(body)}</p>
<p>${escape(strings.back)}</p>
</main>
</body>
</html>
`;
}
