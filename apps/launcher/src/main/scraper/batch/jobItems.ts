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
        // A game removed from the library meanwhile is left out instead of failing the job.
        `insert into scrape_job_items (job_id, game_id, outcome, provider, error, handled_at)
         select @jobId, @gameId, @outcome, @provider, @error, @handledAt
         where exists (select 1 from games where id = @gameId)
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
    // Spelled out per case (no `@x is null or …`) so the indexes serve the order and the limit.
    const where = [
      'i.job_id = @jobId',
      ...(input.outcome ? ['i.outcome = @outcome'] : []),
      ...(input.cursor ? ['(i.handled_at, i.game_id) < (@handledAt, @gameId)'] : []),
    ].join(' and ');
    const rows = this.db.$client
      .prepare(
        `select i.game_id as gameId, m.title as title, g.system_id as systemId,
           i.outcome as outcome, i.provider as provider, i.error as error,
           i.handled_at as handledAt
         from scrape_job_items i join games g on g.id = i.game_id
           join game_metadata m on m.game_id = g.id
         where ${where}
         order by i.handled_at desc, i.game_id desc
         limit @take`,
      )
      .all({
        jobId,
        take: input.limit + 1,
        ...(input.outcome ? { outcome: input.outcome } : {}),
        ...(input.cursor ? input.cursor : {}),
      }) as BatchJobItem[];
    const items = rows.slice(0, input.limit);
    const last = items.at(-1);
    const next =
      rows.length > input.limit && last ? { handledAt: last.handledAt, gameId: last.gameId } : null;
    return { items, next };
  }
}
