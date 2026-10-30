import {
  defaultSettings,
  ok,
  SettingsSchema,
  type Settings,
  type StorageLocation,
} from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { ensureManagedLocation, keepManagedHistory, managedLocationOf } from './managedLocation.ts';

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

  it('a second folder change keeps both old folders under names that differ', () => {
    const managed = { id: ID(2), name: 'Catalog', path: 'E:\\A', priority: 2, managed: true };
    const ids = [ID(3), ID(4)];
    const once = keepManagedHistory(
      base([roms, managed]),
      base([roms, { ...managed, path: 'E:\\B' }]),
      () => ids.shift() ?? '',
    );
    const current = once.storage.locations.find((l) => l.managed);
    if (!current) throw new Error('no managed');
    const edited = once.storage.locations.map((l) => (l.managed ? { ...l, path: 'E:\\C' } : l));
    const twice = keepManagedHistory(once, base(edited), () => ids.shift() ?? '');
    expect(twice.storage.locations.map((l) => [l.name, l.path, l.managed ?? false])).toEqual([
      ['ROMs', 'D:\\ROMs', false],
      ['Catalog (old)', 'E:\\A', false],
      ['Catalog (old 2)', 'E:\\B', false],
      ['Catalog', 'E:\\C', true],
    ]);
    expect(SettingsSchema.safeParse(twice).success).toBe(true);
  });

  it('settings refuse two managed locations', () => {
    const one = { id: ID(2), name: 'A', path: 'E:\\A', priority: 1, managed: true };
    const two = { id: ID(3), name: 'B', path: 'E:\\B', priority: 2, managed: true };
    expect(SettingsSchema.safeParse(base([one, two])).success).toBe(false);
  });
});

describe('managedLocationOf (startCatalog, D45)', () => {
  it('adds the Catalog storage row when missing, saved once, and makes its folder', async () => {
    let saved = base([roms]);
    const saves: number[] = [];
    const made: string[] = [];
    const managed = managedLocationOf({
      current: () => saved,
      update: (change) => {
        saved = change(saved);
        saves.push(saved.storage.locations.length);
        return Promise.resolve(ok({ settings: saved }));
      },
      root: 'E:\\NextLevel',
      newId: () => ID(2),
      mkdir: (path) => {
        made.push(path);
        return Promise.resolve();
      },
    });
    const location = await managed();
    expect(location).toMatchObject({ id: ID(2), path: 'E:\\NextLevel\\Catalog', managed: true });
    expect(saved.storage.locations.map((l) => l.id)).toEqual([ID(1), ID(2)]);
    await managed();
    expect(saves).toEqual([2]);
    expect(made).toEqual(['E:\\NextLevel\\Catalog', 'E:\\NextLevel\\Catalog']);
  });
});
