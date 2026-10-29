import {
  defaultSettings,
  SettingsSchema,
  type Settings,
  type StorageLocation,
} from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { ensureManagedLocation, keepManagedHistory } from './managedLocation.ts';

const ID = (n: number) => `0192f000-0000-7000-8000-00000000000${String(n)}`;
const base = (locations: StorageLocation[]): Settings => {
  const settings = defaultSettings();
  return { ...settings, storage: { ...settings.storage, locations } };
};
const roms: StorageLocation = { id: ID(1), name: 'ROMs', path: 'D:\\ROMs', priority: 1 };

describe('the Catalog games folder (D45, D50)', () => {
  it('adds a managed location in the NextLevel folder, last, when there is none', () => {
    const { settings, location, added } = ensureManagedLocation(base([roms]), 'E:\\NextLevel', () =>
      ID(2),
    );
    expect(added).toBe(true);
    expect(location).toEqual({
      id: ID(2),
      name: 'Catalog',
      path: 'E:\\NextLevel\\Catalog',
      priority: 2,
      managed: true,
    });
    expect(settings.storage.locations.map((l) => l.id)).toEqual([ID(1), ID(2)]);
    expect(SettingsSchema.safeParse(settings).success).toBe(true);
  });

  it('keeps the one that exists', () => {
    const managed = { id: ID(2), name: 'Catalog', path: 'F:\\Games', priority: 2, managed: true };
    const { location, added } = ensureManagedLocation(base([roms, managed]), 'E:\\NextLevel', () =>
      ID(3),
    );
    expect(added).toBe(false);
    expect(location.id).toBe(ID(2));
  });

  it('changing its path keeps the old folder as an ordinary location (installed games still resolve)', () => {
    const managed = {
      id: ID(2),
      name: 'Catalog',
      path: 'E:\\NextLevel\\Catalog',
      priority: 2,
      managed: true,
    };
    const previous = base([roms, managed]);
    const edited = base([roms, { ...managed, path: 'F:\\Catalog' }]);
    const saved = keepManagedHistory(previous, edited, () => ID(3));
    expect(saved.storage.locations).toEqual(
      [
        roms,
        { ...managed, name: 'Catalog (old)', priority: 2, managed: false },
        { id: ID(3), name: 'Catalog', path: 'F:\\Catalog', priority: 3, managed: true },
      ].map((l, i) => ({ ...l, priority: i + 1 })),
    );
  });

  it('a save that leaves the path alone only moves the managed location last', () => {
    const managed = {
      id: ID(2),
      name: 'Catalog',
      path: 'E:\\NextLevel\\Catalog',
      priority: 1,
      managed: true,
    };
    const saved = keepManagedHistory(base([roms, managed]), base([managed, roms]), () => ID(3));
    expect(saved.storage.locations.map((l) => [l.id, l.priority, l.managed])).toEqual([
      [ID(1), 1, undefined],
      [ID(2), 2, true],
    ]);
  });

  it('settings refuse two managed locations', () => {
    const one = { id: ID(2), name: 'A', path: 'E:\\A', priority: 1, managed: true };
    const two = { id: ID(3), name: 'B', path: 'E:\\B', priority: 2, managed: true };
    expect(SettingsSchema.safeParse(base([one, two])).success).toBe(false);
  });
});
