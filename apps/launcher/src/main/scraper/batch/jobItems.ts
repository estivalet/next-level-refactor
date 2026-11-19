import type {
  BatchItemOutcome,
  BatchItemsInput,
  BatchItemsPage,
  BatchJobItem,
} from '@nextlevel/shared';
import type { LibraryDb } from '../../library/openLibrary.ts';

export interface JobItemRecord {
  gameId: number;
  outcome: BatchItemOutcome;
  provider: 'screenscraper' | 'launchbox' | null;
  error: string | null;
  handledAt: string;
}

/**
 * The games a batch job handled (`scrape_job_items`, FR-SCR-8): one row per (job, game), newest
 * first, keyset-paged on (handled_at, game_id) so rows written while paging never repeat.
 */
export class JobItems {
  constructor(private readonly db: LibraryDb) {}

  record(jobId: number, item: JobItemRecord): void {
    this.db.$client
      .prepare(
        `insert into scrape_job_items (job_id, game_id, outcome, provider, error, handled_at)
         values (@jobId, @gameId, @outcome, @provider, @error, @handledAt)
         on conflict (job_id, game_id) do update set outcome = excluded.outcome,
           provider = excluded.provider, error = excluded.error, handled_at = excluded.handled_at`,
      )
      .run({ jobId, ...item });
  }

  count(jobId: number): number {
    return this.db.$client
      .prepare('select count(*) from scrape_job_items where job_id = ?')
      .pluck()
      .get(jobId) as number;
  }

  page(jobId: number, input: BatchItemsInput): BatchItemsPage {
    const rows = this.db.$client
      .prepare(
        `select i.game_id as gameId, m.title as title, g.system_id as systemId,
           i.outcome as outcome, i.provider as provider, i.error as error,
           i.handled_at as handledAt
         from scrape_job_items i join games g on g.id = i.game_id
           join game_metadata m on m.game_id = g.id
         where i.job_id = @jobId
           and (@outcome is null or i.outcome = @outcome)
           and (@handledAt is null or (i.handled_at, i.game_id) < (@handledAt, @gameId))
         order by i.handled_at desc, i.game_id desc
         limit @take`,
      )
      .all({
        jobId,
        outcome: input.outcome ?? null,
        handledAt: input.cursor?.handledAt ?? null,
        gameId: input.cursor?.gameId ?? null,
        take: input.limit + 1,
      }) as BatchJobItem[];
    const items = rows.slice(0, input.limit);
    const last = items.at(-1);
    const next =
      rows.length > input.limit && last ? { handledAt: last.handledAt, gameId: last.gameId } : null;
    return { items, next };
  }
}
