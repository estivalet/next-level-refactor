import {
  DEFAULT_EXPORT_FIELDS,
  EXPORT_FIELDS,
  EXPORT_FORMATS,
  GAMELIST_XML_TAGS,
  REQUIRED_EXPORT_FIELDS,
  type ExportField,
  type ExportFormat,
} from '@nextlevel/shared';

/** What the export dialog remembers on this machine (FR-LIB-11). */
export interface ExportChoices {
  format: ExportFormat;
  fields: ExportField[];
}

const STORAGE_KEY = 'nextlevel.library.export';

export const DEFAULT_CHOICES: ExportChoices = { format: 'csv', fields: [...DEFAULT_EXPORT_FIELDS] };

/** The last choices, or the defaults when nothing (valid) is stored. */
export function readChoices(): ExportChoices {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CHOICES;
    const stored = JSON.parse(raw) as Partial<ExportChoices>;
    const format = EXPORT_FORMATS.find((value) => value === stored.format);
    const fields = Array.isArray(stored.fields)
      ? EXPORT_FIELDS.filter((field) => stored.fields?.includes(field))
      : [];
    return format && fields.length > 0 ? { format, fields } : DEFAULT_CHOICES;
  } catch {
    return DEFAULT_CHOICES;
  }
}

export function saveChoices(choices: ExportChoices): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choices));
  } catch {
    // Storage can be unavailable; the choices then last while the dialog is open.
  }
}

/** How a field's box shows in a format: always on, on/off, or not in this format. */
export function fieldState(
  format: ExportFormat,
  field: ExportField,
): 'required' | 'optional' | 'unsupported' {
  if (REQUIRED_EXPORT_FIELDS[format].includes(field)) return 'required';
  if (format === 'gamelistXml' && GAMELIST_XML_TAGS[field] === undefined) return 'unsupported';
  return 'optional';
}

/** The picked fields with one ticked or unticked, kept in the written order. */
export function toggleField(
  fields: readonly ExportField[],
  field: ExportField,
  on: boolean,
): ExportField[] {
  const next = new Set(fields);
  if (on) next.add(field);
  else next.delete(field);
  return EXPORT_FIELDS.filter((value) => next.has(value));
}
