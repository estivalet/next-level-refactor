import {
  GAMELIST_XML_TAGS,
  exportedFields,
  type ExportField,
  type ExportFormat,
} from '@nextlevel/shared';

/** One game as an export sees it: every field it can write (FR-LIB-11). */
export interface ExportGame {
  title: string;
  /** The system's name, as the Library shows it. */
  system: string;
  year: number | null;
  genre: string | null;
  players: string | null;
  developer: string | null;
  publisher: string | null;
  region: string | null;
  description: string | null;
  /** Community rating, 0..5. */
  rating: number | null;
  userRating: number | null;
  favorite: boolean;
  completed: boolean;
  hidden: boolean;
  missing: boolean;
  /** Where the file is (or, when missing, was expected). */
  path: string;
  /** The file inside its system folder, for gamelist.xml. */
  relPath: string;
  playCount: number;
  lastPlayed: string | null;
  added: string;
  filters: string[];
}

export interface ExportMeta {
  title: string;
  exportedAt: string;
}

type Value = ExportGame[Exclude<keyof ExportGame, 'relPath'>];

const value = (game: ExportGame, field: ExportField): Value => game[field];

/** Writes the games in a format, with the fields it supports (see `exportedFields`). */
export function renderExport(
  format: ExportFormat,
  games: readonly ExportGame[],
  picked: readonly ExportField[],
  meta: ExportMeta,
): string {
  const fields = exportedFields(format, picked);
  if (format === 'csv') return toCsv(games, fields);
  if (format === 'json') return toJson(games, fields, meta);
  return toGamelistXml(games, fields);
}

function csvCell(raw: Value): string {
  const text = raw === null ? '' : Array.isArray(raw) ? raw.join('; ') : String(raw);
  return /[",\r\n]|^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const BOM = String.fromCharCode(0xfeff);

/** RFC 4180 with a UTF-8 BOM, so Excel reads accents right. */
function toCsv(games: readonly ExportGame[], fields: readonly ExportField[]): string {
  const lines = [fields.join(',')];
  for (const game of games) {
    lines.push(fields.map((field) => csvCell(value(game, field))).join(','));
  }
  return `${BOM}${lines.join('\r\n')}\r\n`;
}

function toJson(
  games: readonly ExportGame[],
  fields: readonly ExportField[],
  meta: ExportMeta,
): string {
  const rows = games.map((game) =>
    Object.fromEntries(fields.map((field) => [field, value(game, field)])),
  );
  const document = { ...meta, count: games.length, fields, games: rows };
  return `${JSON.stringify(document, null, 2)}\n`;
}

// XML 1.0 can't hold most control characters, even escaped.
// eslint-disable-next-line no-control-regex -- the control characters are what it removes
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

function xmlText(text: string): string {
  return text
    .replace(XML_INVALID, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** ES dates: `YYYYMMDDTHHMMSS`. */
function esDate(iso: string): string {
  return iso.slice(0, 19).replace(/[-:]/g, '');
}

/** The ES value of a field, or null to leave the tag out (empty, false or zero). */
function xmlValue(game: ExportGame, field: ExportField): string | null {
  switch (field) {
    case 'path':
      return `./${game.relPath.replace(/\\/g, '/')}`;
    case 'year':
      return game.year === null ? null : `${String(game.year)}0101T000000`;
    case 'rating':
      // ES rates 0..1.
      return game.rating === null ? null : String(Math.round((game.rating / 5) * 100) / 100);
    case 'favorite':
    case 'hidden':
    case 'completed':
      return game[field] ? 'true' : null;
    case 'playCount':
      return game.playCount > 0 ? String(game.playCount) : null;
    case 'lastPlayed':
      return game.lastPlayed === null ? null : esDate(game.lastPlayed);
    default: {
      const raw = value(game, field);
      return raw === null || raw === '' ? null : String(raw);
    }
  }
}

/** EmulationStation's `gamelist.xml`: path first, then the other tags in field order. */
function toGamelistXml(games: readonly ExportGame[], fields: readonly ExportField[]): string {
  const ordered: ExportField[] = ['path', ...fields.filter((field) => field !== 'path')];
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<gameList>'];
  for (const game of games) {
    lines.push('  <game>');
    for (const field of ordered) {
      const text = xmlValue(game, field);
      const tag = GAMELIST_XML_TAGS[field];
      if (text !== null && tag) lines.push(`    <${tag}>${xmlText(text)}</${tag}>`);
    }
    lines.push('  </game>');
  }
  lines.push('</gameList>', '');
  return lines.join('\n');
}
