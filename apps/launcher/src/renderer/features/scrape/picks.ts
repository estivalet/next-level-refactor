import {
  GAME_ART_KINDS,
  SCRAPE_FIELDS,
  type GameArtKind,
  type ScrapeField,
  type ScrapePreview,
} from '@nextlevel/shared';

/** Ticked preview rows, keyed `art:<kind>` / `field:<field>`. */
export type Picks = Readonly<Record<string, boolean>>;

export const artKey = (kind: GameArtKind) => `art:${kind}`;
export const fieldKey = (field: ScrapeField) => `field:${field}`;

const empty = (value: string | number | null) => value === null || value === '';

/**
 * What the dialog ticks first (US-C5, D19): available art the game lacks and scraped fields it
 * has no value for; with Overwrite, everything available. `title` and locked (user-edited) fields
 * are never ticked for the user — ticking one is their call.
 */
export function defaultPicks(preview: ScrapePreview, overwrite: boolean): Picks {
  const picks: Record<string, boolean> = {};
  for (const kind of GAME_ART_KINDS) {
    const art = preview.art[kind];
    picks[artKey(kind)] = art.available && (overwrite || !art.local);
  }
  for (const field of SCRAPE_FIELDS) {
    const row = preview.fields[field];
    picks[fieldKey(field)] =
      field !== 'title' && !row.locked && !empty(row.scraped) && (overwrite || empty(row.current));
  }
  return picks;
}

/** The ticked kinds and fields, in contract order. */
export function selectionOf(picks: Picks): { kinds: GameArtKind[]; fields: ScrapeField[] } {
  return {
    kinds: GAME_ART_KINDS.filter((kind) => picks[artKey(kind)]),
    fields: SCRAPE_FIELDS.filter((field) => picks[fieldKey(field)]),
  };
}
