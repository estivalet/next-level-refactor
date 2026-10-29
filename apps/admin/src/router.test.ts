import { describe, expect, it } from 'vitest';
import { hrefOf, parseRoute } from './router.ts';

describe('console routes (S13)', () => {
  it('hash routes map to pages; anything else is the dashboard', () => {
    expect(parseRoute('#/users')).toEqual({ page: 'users' });
    expect(parseRoute('#/users/abc-1')).toEqual({ page: 'user', id: 'abc-1' });
    expect(parseRoute('#/audit')).toEqual({ page: 'audit' });
    expect(parseRoute('#/settings')).toEqual({ page: 'settings' });
    expect(parseRoute('')).toEqual({ page: 'dashboard' });
    expect(parseRoute('#/nope')).toEqual({ page: 'dashboard' });
    expect(parseRoute('#/users/a%20b')).toEqual({ page: 'user', id: 'a b' });
    expect(parseRoute('#/plans')).toEqual({ page: 'plans' });
    expect(parseRoute('#/plans/new')).toEqual({ page: 'planNew' });
    expect(parseRoute('#/plans/p1')).toEqual({ page: 'plan', id: 'p1' });
    expect(parseRoute('#/scopes')).toEqual({ page: 'scopes' });
  });

  it('FR-ADM-3: catalog routes carry the item and its tab (Metadata when missing or unknown)', () => {
    expect(parseRoute('#/catalog')).toEqual({ page: 'catalog' });
    expect(parseRoute('#/catalog/new')).toEqual({ page: 'catalogNew' });
    expect(parseRoute('#/catalog/i1')).toEqual({ page: 'catalogItem', id: 'i1', tab: 'metadata' });
    expect(parseRoute('#/catalog/i1/license')).toEqual({
      page: 'catalogItem',
      id: 'i1',
      tab: 'license',
    });
    expect(parseRoute('#/catalog/i1/nope')).toEqual({
      page: 'catalogItem',
      id: 'i1',
      tab: 'metadata',
    });
    const item = { page: 'catalogItem', id: 'a b', tab: 'files' } as const;
    expect(parseRoute(hrefOf(item))).toEqual(item);
  });

  it('links round-trip', () => {
    expect(parseRoute(hrefOf({ page: 'user', id: 'x/y' }))).toEqual({ page: 'user', id: 'x/y' });
    expect(parseRoute(hrefOf({ page: 'plan', id: 'p 1' }))).toEqual({ page: 'plan', id: 'p 1' });
    expect(parseRoute(hrefOf({ page: 'planNew' }))).toEqual({ page: 'planNew' });
  });
});
