import {
  AppErrorException,
  ERROR_CODES,
  SmartFilterQuerySchema,
  type CollectionSort,
  type GameScope,
} from '@nextlevel/shared';
import type Database from 'better-sqlite3';
import { smartFilterIdsSql } from './smartFilterSql.ts';

function missingScope(details: object): AppErrorException {
  return new AppErrorException({ code: 'NOT_FOUND', message: ERROR_CODES.NOT_FOUND, details });
}

/**
 * What a list query of a scope needs besides its shape: a collection's own sort, a smart filter's
 * `select id, rn` query, and the parameters (`@systemId`, `@collectionId`, the filter's own).
 * NOT_FOUND when the collection or smart filter is gone.
 */
export function resolveScope(
  statement: (sql: string) => Database.Statement,
  scope: GameScope,
  now: Date,
) {
  let collectionSort: CollectionSort | null = null;
  let smart: ReturnType<typeof smartFilterIdsSql> | null = null;
  if (scope.kind === 'collection') {
    const sort = statement('select sort from collections where id = ?')
      .pluck()
      .get(scope.collectionId) as CollectionSort | undefined;
    if (sort === undefined) throw missingScope({ collectionId: scope.collectionId });
    collectionSort = sort;
  }
  if (scope.kind === 'smartFilter') {
    const raw = statement('select query from smart_filters where id = ?')
      .pluck()
      .get(scope.smartFilterId) as string | undefined;
    if (raw === undefined) throw missingScope({ smartFilterId: scope.smartFilterId });
    smart = smartFilterIdsSql(SmartFilterQuerySchema.parse(JSON.parse(raw)), now);
  }
  const params: Record<string, unknown> = {
    ...(scope.kind === 'system' ? { systemId: scope.systemId } : {}),
    ...(scope.kind === 'collection' ? { collectionId: scope.collectionId } : {}),
    ...smart?.params,
  };
  return { collectionSort, smart, params };
}
