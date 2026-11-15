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
  it('FR-MUS-1: a catalog system with a seed entry returns the seed', () => {
    expect(baseSystemInfo(definition('aamber-pegasus'), undefined)).toBe(
      systemInfoSeed('aamber-pegasus'),
    );
  });

  it('FR-MUS-1: a system with no seed is just its id', () => {
    expect(baseSystemInfo(definition('no-such-seed'), undefined)).toEqual({
      systemId: 'no-such-seed',
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
