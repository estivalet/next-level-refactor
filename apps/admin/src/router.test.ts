import { describe, expect, it } from 'vitest';
import { hrefOf, parseRoute } from './router.ts';

describe('console routes (S13)', () => {
  it('hash routes map to pages; anything else is the users list', () => {
    expect(parseRoute('#/users')).toEqual({ page: 'users' });
    expect(parseRoute('#/users/abc-1')).toEqual({ page: 'user', id: 'abc-1' });
    expect(parseRoute('#/audit')).toEqual({ page: 'audit' });
    expect(parseRoute('#/settings')).toEqual({ page: 'settings' });
    expect(parseRoute('')).toEqual({ page: 'users' });
    expect(parseRoute('#/nope')).toEqual({ page: 'users' });
    expect(parseRoute('#/users/a%20b')).toEqual({ page: 'user', id: 'a b' });
    expect(parseRoute('#/plans')).toEqual({ page: 'plans' });
    expect(parseRoute('#/plans/new')).toEqual({ page: 'planNew' });
    expect(parseRoute('#/plans/p1')).toEqual({ page: 'plan', id: 'p1' });
    expect(parseRoute('#/scopes')).toEqual({ page: 'scopes' });
  });

  it('links round-trip', () => {
    expect(parseRoute(hrefOf({ page: 'user', id: 'x/y' }))).toEqual({ page: 'user', id: 'x/y' });
    expect(parseRoute(hrefOf({ page: 'plan', id: 'p 1' }))).toEqual({ page: 'plan', id: 'p 1' });
    expect(parseRoute(hrefOf({ page: 'planNew' }))).toEqual({ page: 'planNew' });
  });
});
