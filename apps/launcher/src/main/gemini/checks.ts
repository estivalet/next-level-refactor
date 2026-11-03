import type { GeminiAnswer, GeminiField, GeminiFieldAnswer } from '@nextlevel/shared';

const UNKNOWN: GeminiFieldAnswer = { known: false, value: null };
const FILLERS = new Set(['unknown', 'n/a', 'na', 'none', '?', '-', 'tbd']);
const REFUSALS = [/^i'?m sorry/i, /^i cannot/i, /^i can'?t/i, /^i don'?t have/i, /^as an ai/i];
const MAX_TEXT = 100;
const MAX_DESCRIPTION = 600;
const MAX_PLAYERS = 16;

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const trimmed = String(value).trim();
  if (trimmed === '' || trimmed.length > max || FILLERS.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

function year(value: unknown, now: Date): number | null {
  const raw = text(value, 4);
  if (raw === null || !/^\d{4}$/.test(raw)) return null;
  const number = Number(raw);
  return number >= 1950 && number <= now.getFullYear() ? number : null;
}

function players(value: unknown): string | null {
  const raw = text(value, 5);
  const match = raw === null ? null : /^(\d{1,2})(?:-(\d{1,2}))?$/.exec(raw);
  if (!match) return null;
  const counts = [match[1], match[2]].filter((part) => part !== undefined).map(Number);
  return counts.every((count) => count >= 1 && count <= MAX_PLAYERS) ? (raw as string) : null;
}

function description(value: unknown): string | null {
  const raw = text(value, MAX_DESCRIPTION);
  return raw === null || REFUSALS.some((refusal) => refusal.test(raw)) ? null : raw;
}

function checkField(field: GeminiField, value: unknown, now: Date): string | number | null {
  switch (field) {
    case 'year':
      return year(value, now);
    case 'players':
      return players(value);
    case 'description':
      return description(value);
    default:
      return text(value, MAX_TEXT);
  }
}

/** The raw `{ known, value }` of a key, or null when the item doesn't claim to know it. */
function claimed(item: Record<string, unknown>, key: string): unknown {
  const entry = item[key];
  if (typeof entry !== 'object' || entry === null) return null;
  const { known, value } = entry as { known?: unknown; value?: unknown };
  return known === true ? value : null;
}

const normalize = (title: string) => title.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/**
 * Checks one raw answer item (FR-SCR-7, spec §6): anything doubtful becomes unknown; fields not
 * asked are dropped; a title equal to the current one (ignoring case/punctuation) is no suggestion.
 */
export function checkAnswer(
  raw: unknown,
  game: { gameId: number; title: string },
  fields: GeminiField[],
  now: Date,
): Pick<GeminiAnswer, 'fields' | 'title'> {
  const item = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const checked: GeminiAnswer['fields'] = {};
  for (const field of fields) {
    const value = checkField(field, claimed(item, field), now);
    checked[field] = value === null ? UNKNOWN : { known: true, value };
  }
  const title = text(claimed(item, 'title'), 300);
  const suggestion = title !== null && normalize(title) !== normalize(game.title) ? title : null;
  return { fields: checked, title: suggestion };
}
