import type { SystemDefinition } from '@nextlevel/shared';

/** A catalog system for tests; folder name defaults to the id. */
export function system(id: string, overrides: Partial<SystemDefinition> = {}): SystemDefinition {
  return {
    id,
    name: id,
    kind: 'other',
    extensions: ['zip'],
    defaultFolderName: id,
    scraper: {},
    presetProfiles: [],
    aliases: [],
    ...overrides,
  };
}
