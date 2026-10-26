import type { AuditEntry } from '@nextlevel/shared';
import { and, desc, eq, lt, or, type SQL } from 'drizzle-orm';
import type { ApiContext } from '../context.ts';
import { auditLog, users } from '../db/schema.ts';
import { apiError } from '../errors.ts';

export interface AuditInput {
  action: string;
  targetType: AuditEntry['targetType'];
  targetId: string;
  before: unknown;
  after: unknown;
}

/**
 * Runs an admin change and its audit entries in one transaction (FR-ADM-5, C11): if the log
 * can't be written, the change isn't made either. The log is append-only.
 */
export function audited<T>(
  ctx: ApiContext,
  actorId: string,
  entries: readonly AuditInput[],
  mutate: () => T,
): T {
  return ctx.db.transaction((tx) => {
    const result = mutate();
    const at = ctx.clock().toISOString();
    for (const entry of entries) {
      tx.insert(auditLog)
        .values({ id: ctx.newId(), actorId, at, ...entry })
        .run();
    }
    return result;
  });
}

const cursorOf = (at: string, id: string) => Buffer.from(`${at}|${id}`).toString('base64url');

function afterCursor(cursor: string | undefined): SQL | undefined {
  if (!cursor) return undefined;
  const [at, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  if (!at || !id) throw apiError('VALIDATION_FAILED', 'Bad cursor.');
  return or(lt(auditLog.at, at), and(eq(auditLog.at, at), lt(auditLog.id, id)));
}

/** Newest first; `targets` limits to entries about those ids (a user and their devices). */
export function auditPage(
  ctx: ApiContext,
  opts: { actor?: string; targets?: string[]; cursor?: string; limit: number },
): { items: AuditEntry[]; nextCursor: string | null } {
  const filters = [
    opts.actor ? eq(auditLog.actorId, opts.actor) : undefined,
    opts.targets ? or(...opts.targets.map((id) => eq(auditLog.targetId, id))) : undefined,
    afterCursor(opts.cursor),
  ].filter((f): f is SQL => f !== undefined);
  const rows = ctx.db
    .select({ entry: auditLog, actorEmail: users.email })
    .from(auditLog)
    .innerJoin(users, eq(users.id, auditLog.actorId))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(auditLog.at), desc(auditLog.id))
    .limit(opts.limit + 1)
    .all();
  const items = rows.slice(0, opts.limit).map(({ entry, actorEmail }) => ({
    id: entry.id,
    actor: { id: entry.actorId, email: actorEmail },
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    before: entry.before,
    after: entry.after,
    at: entry.at,
  }));
  const last = items.at(-1);
  return {
    items,
    nextCursor: rows.length > opts.limit && last ? cursorOf(last.at, last.id) : null,
  };
}
