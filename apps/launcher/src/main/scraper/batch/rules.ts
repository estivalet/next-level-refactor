import type {
  BatchField,
  BatchRules,
  GameArtKind,
  GameDetails,
  ScrapeSearchResult,
} from '@nextlevel/shared';
import type { MediaRepository } from '../../library/MediaRepository.ts';

/** A single candidate this close is applied without asking (D18). */
export const AUTO_APPLY_SIMILARITY = 90;

export type BatchOutcome =
  { kind: 'apply'; providerGameId: number } | { kind: 'review' } | { kind: 'notFound' };

/** D18: apply on a hash match or a lone candidate ≥ 90; several or a weak one → review. */
export function decide(found: ScrapeSearchResult): BatchOutcome {
  const [first, ...rest] = found.candidates;
  if (!first) return { kind: 'notFound' };
  if (found.method === 'hash' || (rest.length === 0 && first.similarity >= AUTO_APPLY_SIMILARITY)) {
    return { kind: 'apply', providerGameId: first.providerGameId };
  }
  return { kind: 'review' };
}

const empty = (value: unknown) => value === null || value === undefined || value === '';

/**
 * What a batch writes for one game: never locked fields (D19); with `onlyMissing`, only kinds the
 * game lacks and fields without a value.
 */
export function batchTargets(
  rules: BatchRules,
  game: GameDetails,
  media: Pick<MediaRepository, 'kindsByGame'>,
): { kinds: GameArtKind[]; fields: BatchField[] } {
  const local = new Set(rules.onlyMissing ? (media.kindsByGame([game.id]).get(game.id) ?? []) : []);
  const locked = new Set(game.lockedFields);
  return {
    kinds: rules.kinds.filter((kind) => !local.has(kind)),
    fields: rules.fields.filter(
      (field) => !locked.has(field) && (!rules.onlyMissing || empty(game[field])),
    ),
  };
}
