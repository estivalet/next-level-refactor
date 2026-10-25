import {
  GAME_ART_KINDS,
  SCRAPE_FIELDS,
  type ScrapeCandidate,
  type ScrapeField,
  type ScrapePreview,
} from '@nextlevel/shared';

type FieldRow = ScrapePreview['fields'][ScrapeField];

/**
 * An invented preview: every kind missing and unavailable, every field empty and not scraped,
 * then the given overrides.
 */
export function preview(
  art: Partial<ScrapePreview['art']> = {},
  fields: Partial<Record<ScrapeField, Partial<FieldRow>>> = {},
): ScrapePreview {
  return {
    art: Object.fromEntries(
      GAME_ART_KINDS.map((kind) => [kind, art[kind] ?? { local: false, available: false }]),
    ) as ScrapePreview['art'],
    fields: Object.fromEntries(
      SCRAPE_FIELDS.map((field) => [
        field,
        { current: null, scraped: null, locked: false, ...fields[field] },
      ]),
    ) as ScrapePreview['fields'],
  };
}

/** The preview most dialog tests use: a local box, a missing logo, a locked genre. */
export const SAMPLE_PREVIEW = preview(
  {
    'box-front': { local: true, available: true },
    'logo-clear': { local: false, available: true },
    video: { local: false, available: true },
  },
  {
    title: { current: 'Racer', scraped: 'Zoom Racer' },
    genre: { current: 'Mine', scraped: 'Racing', locked: true },
    year: { current: null, scraped: 1994 },
    developer: { current: 'Old Dev', scraped: 'Dev Co' },
  },
);

export function candidate(id: number, name: string, similarity: number): ScrapeCandidate {
  return { providerGameId: id, name, year: '1994', region: 'us', similarity, thumb: null };
}
