import {
  SmartFilterNameSchema,
  SmartFilterQuerySchema,
  type SmartFilterPlayed,
  type SmartFilterQuery,
  type SmartFilterSort,
} from '@nextlevel/shared';

/** The smart filter dialog's fields as typed (FR-LIB-9, D10); numbers stay text until saved. */
export interface SmartForm {
  name: string;
  systems: string[];
  favorite: boolean;
  /** Filter tags, comma separated. */
  filters: string;
  genre: string;
  yearFrom: string;
  yearTo: string;
  minPlayers: string;
  played: SmartFilterPlayed;
  playedWithinDays: string;
  sort: SmartFilterSort;
  limit: string;
}

export type SmartField = keyof SmartForm;

export const EMPTY_SMART_FORM: SmartForm = {
  name: '',
  systems: [],
  favorite: false,
  filters: '',
  genre: '',
  yearFrom: '',
  yearTo: '',
  minPlayers: '',
  played: 'any',
  playedWithinDays: '',
  sort: 'title',
  limit: '',
};

const NUMBER_FIELDS = ['yearFrom', 'yearTo', 'minPlayers', 'playedWithinDays', 'limit'] as const;

export type SmartFormResult =
  | { ok: true; name: string; query: SmartFilterQuery }
  | { ok: false; errors: Partial<Record<SmartField, string>> };

const errorKey = (field: string) => `library.smart.errors.${field}`;

/** The form as a query, or an i18n message key per field that is wrong. */
export function toQuery(form: SmartForm): SmartFormResult {
  const errors: Partial<Record<SmartField, string>> = {};
  const name = SmartFilterNameSchema.safeParse(form.name);
  if (!name.success) errors.name = errorKey('name');
  const input: Record<string, unknown> = {
    systems: form.systems,
    played: form.played,
    sort: form.sort,
  };
  if (form.favorite) input['favorite'] = true;
  const tags = form.filters
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '');
  if (tags.length > 0) input['filters'] = tags;
  if (form.genre.trim() !== '') input['genre'] = form.genre.trim();
  for (const field of NUMBER_FIELDS) {
    const text = form[field].trim();
    if (text === '') continue;
    // Not a whole number: send something the schema refuses for this field.
    input[field] = /^\d+$/.test(text) ? Number(text) : Number.NaN;
  }
  const parsed = SmartFilterQuerySchema.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? '') as SmartField;
      if (field in errors) continue;
      errors[field] = issue.message === 'yearRange' ? errorKey('yearRange') : errorKey(field);
    }
  }
  if (!name.success || !parsed.success) return { ok: false, errors };
  return { ok: true, name: name.data, query: parsed.data };
}

/** A saved filter back in the form's terms. */
export function fromQuery(name: string, query: SmartFilterQuery): SmartForm {
  const text = (value: number | undefined) => (value === undefined ? '' : String(value));
  return {
    name,
    systems: [...query.systems],
    favorite: query.favorite === true,
    filters: (query.filters ?? []).join(', '),
    genre: query.genre ?? '',
    yearFrom: text(query.yearFrom),
    yearTo: text(query.yearTo),
    minPlayers: text(query.minPlayers),
    played: query.played,
    playedWithinDays: text(query.playedWithinDays),
    sort: query.sort,
    limit: text(query.limit),
  };
}
