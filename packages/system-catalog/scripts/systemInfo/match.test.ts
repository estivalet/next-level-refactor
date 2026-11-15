import type { SystemDefinition } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { matchSystemId } from './match.ts';

const systems = [
  {
    id: 'fakeone',
    name: 'Fake Console One',
    aliases: ['FC-1'],
    scraper: { launchboxPlatform: 'Acme Fake One' },
  },
  { id: 'faketwo', name: 'Fake Two', aliases: [], scraper: {} },
] as unknown as SystemDefinition[];

describe('matchSystemId', () => {
  it('FR-MUS-1: matches name, alias, launchboxPlatform; null otherwise', () => {
    expect(matchSystemId('fake console one', systems)).toBe('fakeone');
    expect(matchSystemId('FC 1', systems)).toBe('fakeone');
    expect(matchSystemId('Acme: Fake One', systems)).toBe('fakeone');
    expect(matchSystemId('Fake-Two', systems)).toBe('faketwo');
    expect(matchSystemId('Nothing', systems)).toBeNull();
    expect(matchSystemId('!!!', systems)).toBeNull();
  });
});
