import {
  EDITABLE_FIELDS,
  MetadataChangesSchema,
  type EditableField,
  type GameDetails,
  type MetadataChanges,
} from '@nextlevel/shared';

/** The edit form's text for each field. */
export type EditDraft = Record<EditableField, string>;

export function draftOf(game: GameDetails): EditDraft {
  return {
    title: game.title,
    year: game.year === null ? '' : String(game.year),
    developer: game.developer ?? '',
    publisher: game.publisher ?? '',
    genre: game.genre ?? '',
    players: game.players ?? '',
    description: game.description ?? '',
    region: game.region ?? '',
    filters: game.filters.join(', '),
  };
}

function parseFilters(text: string): string[] {
  return text
    .split(',')
    .map((filter) => filter.trim())
    .filter(Boolean);
}

/**
 * Only the fields whose text changed, as the shared schema expects them, plus the fields that
 * fail validation (FR-LIB-6: an edit sends, and locks, only what the user changed).
 */
export function changesOf(
  original: EditDraft,
  draft: EditDraft,
): { changes: MetadataChanges | null; invalid: Set<EditableField> } {
  const raw: Record<string, unknown> = {};
  const invalid = new Set<EditableField>();
  for (const field of EDITABLE_FIELDS) {
    if (draft[field] === original[field]) continue;
    const text = draft[field];
    if (field === 'year') {
      const year = text.trim() === '' ? null : Number(text);
      if (year !== null && !Number.isInteger(year)) invalid.add('year');
      raw.year = year;
    } else if (field === 'filters') {
      raw.filters = parseFilters(text);
    } else {
      raw[field] = text;
    }
  }
  if (Object.keys(raw).length === 0) return { changes: null, invalid };
  const parsed = MetadataChangesSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string') invalid.add(field as EditableField);
    }
    return { changes: null, invalid };
  }
  return { changes: invalid.size > 0 ? null : parsed.data, invalid };
}
