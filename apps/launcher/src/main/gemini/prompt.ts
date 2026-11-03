import type { GeminiField } from '@nextlevel/shared';

/** One game as Gemini sees it; `known` = details the game already has (context only). */
export interface PromptGame {
  gameId: number;
  system: string;
  title: string;
  file: string;
  known: Partial<Record<GeminiField, string | number>>;
}

const FIELD_HELP: Record<GeminiField, string> = {
  description: 'a short, factual overview of the game (2–3 sentences)',
  year: 'the year of its first release on this system (4 digits)',
  developer: 'the company that developed it',
  publisher: 'the company that published it on this system',
  genre: 'its genre (e.g. "Sports", "Platform")',
  players: 'how many players it supports (e.g. "1", "1-2", "4")',
};

/**
 * The request text (FR-SCR-7, spec §6). Unknown is the expected answer when not sure; the
 * gameId echo lets main match each answer to its game. The website tool uses the same rules.
 */
export function buildPrompt(games: PromptGame[], fields: GeminiField[], language: string): string {
  const keys = ['gameId', 'title', ...fields].map((key) => `"${key}"`).join(', ');
  const help = fields.map((field) => `- "${field}": ${FIELD_HELP[field]}`).join('\n');
  const list = games
    .map((game) =>
      JSON.stringify(
        {
          gameId: game.gameId,
          system: game.system,
          title: game.title,
          file: game.file,
          ...(Object.keys(game.known).length > 0 ? { known: game.known } : {}),
        },
        null,
        1,
      ),
    )
    .join('\n');
  return [
    'You are a careful video game historian. For each game below, answer only what you are sure of.',
    'Rule: never guess; a wrong value is worse than none. If you are not sure, answer {"known": false, "value": null}.',
    `Return a JSON array with one object per game, with the keys ${keys}.`,
    'Copy "gameId" exactly as given. Every other key is an object {"known": true|false, "value": ...}.',
    '- "title": the official title only if the given one is wrong or badly formatted; otherwise known false.',
    help,
    `Write "description" in ${language}. "known" details are context only; don't repeat them.`,
    '',
    'Games:',
    list,
  ].join('\n');
}

const answerSchema = (type: 'STRING' | 'INTEGER') => ({
  type: 'OBJECT',
  properties: { known: { type: 'BOOLEAN' }, value: { type, nullable: true } },
  required: ['known'],
});

/** Gemini `responseSchema` for structured output (OpenAPI subset, upper-case types). */
export function responseSchema(fields: GeminiField[]): object {
  const properties: Record<string, object> = {
    gameId: { type: 'INTEGER' },
    title: answerSchema('STRING'),
  };
  for (const field of fields)
    properties[field] = answerSchema(field === 'year' ? 'INTEGER' : 'STRING');
  return {
    type: 'ARRAY',
    items: { type: 'OBJECT', properties, required: ['gameId', ...fields] },
  };
}

/** The first JSON array in a reply (code fences and prose around it ignored); null if none. */
export function parseReply(text: string): unknown[] | null {
  const clean = text.replace(/```(?:json)?/gi, '');
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start === -1 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(clean.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
