import { describe, expect, it } from 'vitest';
import { apps } from '../../apps/registry.ts';
import { filterApps } from './filterApps.ts';

const t = (key: string) => (key === 'apps.settings.title' ? 'Settings' : key);

describe('filterApps', () => {
  it('FR-SHELL-5: matches the translated title case-insensitively', () => {
    expect(filterApps(apps, 'SET', t).map((app) => app.id)).toEqual(['settings']);
  });

  it('FR-SHELL-5: returns nothing when no title matches', () => {
    expect(filterApps(apps, 'xyz', t)).toEqual([]);
  });

  it('FR-SHELL-5: a blank query returns every app', () => {
    expect(filterApps(apps, '   ', t)).toEqual(apps);
  });
});
