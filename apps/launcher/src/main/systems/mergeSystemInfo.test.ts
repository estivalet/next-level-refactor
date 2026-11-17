import type { SystemDefinition } from '@nextlevel/shared';
import { systemInfoSeed } from '@nextlevel/system-catalog';
import { describe, expect, it } from 'vitest';
import { baseSystemInfo } from './mergeSystemInfo.ts';

const definition = (id: string): SystemDefinition => ({
  id,
  name: id,
  kind: 'console',
  extensions: ['zip'],
  defaultFolderName: id,
  scraper: {},
  presetProfiles: [],
  aliases: [],
});

describe('baseSystemInfo', () => {
  it('FR-MUS-1, FR-MUS-10: a catalog system with a seed entry returns the seed with its kind, leaving the seed as shipped', () => {
    expect(baseSystemInfo(definition('aamber-pegasus'), undefined)).toEqual({
      ...systemInfoSeed('aamber-pegasus'),
      kind: 'console',
    });
    expect(systemInfoSeed('aamber-pegasus')?.kind).toBeUndefined();
  });

  it('FR-MUS-1, FR-MUS-10: a system with no seed is just its id and kind', () => {
    expect(baseSystemInfo(definition('no-such-seed'), undefined)).toEqual({
      systemId: 'no-such-seed',
      kind: 'console',
      models: [],
      peripherals: [],
      topGames: [],
      sources: [],
    });
  });

  it('FR-MUS-1: a custom system uses manufacturer, release year and description from settings', () => {
    const custom = {
      id: 'custom-box',
      name: 'Box',
      manufacturer: 'Acme',
      releaseYear: 1990,
      description: 'A box.',
      kind: 'console' as const,
      folderName: 'box',
      extensions: ['bin'],
    };
    expect(baseSystemInfo(definition('custom-box'), custom)).toMatchObject({
      systemId: 'custom-box',
      manufacturer: 'Acme',
      releaseYear: 1990,
      description: 'A box.',
    });
  });
});
