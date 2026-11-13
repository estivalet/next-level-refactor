import type { SyncEntries } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import {
  changedKeys,
  clampEntries,
  EPOCH,
  mergeEntries,
  stampLocal,
  type LocalView,
} from './merge.ts';

const NOW = new Date('2026-11-13T12:00:00.000Z');
const at = (day: number) => `2026-11-${String(day).padStart(2, '0')}T12:00:00.000Z`;

function view(
  values: Record<string, unknown>,
  holds: (key: string) => boolean = () => true,
): LocalView {
  return { values: new Map(Object.entries(values)), holds, subject: () => null };
}

describe('sync merge (FR-SET-5, D55)', () => {
  it('merge: newer entry wins per key; a tombstone removes; equal stamps take remote', () => {
    const local: SyncEntries = {
      a: { value: 'local-a', updatedAt: at(10) },
      b: { value: 'local-b', updatedAt: at(5) },
      c: { value: 'local-c', updatedAt: at(7) },
      d: { value: 'only-local', updatedAt: at(1) },
    };
    const remote: SyncEntries = {
      a: { value: 'remote-a', updatedAt: at(9) },
      b: { value: 'remote-b', updatedAt: at(6) },
      c: { value: null, updatedAt: at(8), deleted: true },
      e: { value: 'only-remote', updatedAt: at(1) },
    };
    const merged = mergeEntries(local, remote, NOW);
    expect(merged['a']?.value).toBe('local-a');
    expect(merged['b']?.value).toBe('remote-b');
    expect(merged['c']).toEqual({ value: null, updatedAt: at(8), deleted: true });
    expect(merged['d']?.value).toBe('only-local');
    expect(merged['e']?.value).toBe('only-remote');
    const tie = mergeEntries(
      { x: { value: 1, updatedAt: at(3) } },
      { x: { value: 2, updatedAt: at(3) } },
      NOW,
    );
    expect(tie['x']?.value).toBe(2);
  });

  it('tombstones older than 90 days are pruned', () => {
    const merged = mergeEntries(
      { old: { value: null, updatedAt: '2026-08-01T00:00:00.000Z', deleted: true } },
      { fresh: { value: null, updatedAt: at(1), deleted: true } },
      NOW,
    );
    expect(Object.keys(merged)).toEqual(['fresh']);
  });

  it("entries stamped after the server's document are clamped to it (a PC clock in the future)", () => {
    const clamped = clampEntries(
      { a: { value: 1, updatedAt: '2030-01-01T00:00:00.000Z' }, b: { value: 2, updatedAt: at(1) } },
      at(5),
    );
    expect(clamped['a']?.updatedAt).toBe(at(5));
    expect(clamped['b']?.updatedAt).toBe(at(1));
  });

  it('a local change is stamped now (never older than the copy it replaces); a removal leaves a tombstone', () => {
    const base: SyncEntries = {
      same: { value: 1, updatedAt: at(1) },
      changed: { value: 1, updatedAt: '2026-11-20T00:00:00.000Z' },
      removed: { value: 1, updatedAt: at(1) },
      waiting: { value: 1, updatedAt: at(1) },
    };
    const local = stampLocal(
      base,
      new Set(),
      view({ same: 1, changed: 2, added: 3 }, (key) => key !== 'waiting'),
      NOW,
      false,
    );
    expect(local['same']).toEqual(base['same']);
    expect(local['changed']).toEqual({ value: 2, updatedAt: '2026-11-20T00:00:00.001Z' });
    expect(local['added']).toEqual({ value: 3, updatedAt: NOW.toISOString() });
    expect(local['removed']).toEqual({ value: null, updatedAt: NOW.toISOString(), deleted: true });
    // This PC can't hold it (a game it doesn't have): kept as it was.
    expect(local['waiting']).toEqual(base['waiting']);
  });

  it("the first sync on a PC stamps its values as oldest, so the account's copy wins", () => {
    const local = stampLocal({}, new Set(), view({ language: 'en' }), NOW, true);
    expect(local['language']).toEqual({ value: 'en', updatedAt: EPOCH });
    expect(
      mergeEntries(local, { language: { value: 'pt-BR', updatedAt: at(1) } }, NOW)['language']
        ?.value,
    ).toBe('pt-BR');
  });

  it("a game that just appeared here takes the document's state instead of overwriting it", () => {
    const base: SyncEntries = {
      'g:snes/mario.zip': { value: { favorite: true }, updatedAt: at(1) },
    };
    const fresh: LocalView = {
      values: new Map([['g:snes/mario.zip', { favorite: false }]]),
      holds: () => true,
      subject: () => 'snes/mario.zip',
    };
    expect(stampLocal(base, new Set(), fresh, NOW, false)).toEqual(base);
    // Held at the last sync too: the local value is a change.
    const changed = stampLocal(base, new Set(['snes/mario.zip']), fresh, NOW, false);
    expect(changed['g:snes/mario.zip']?.value).toEqual({ favorite: false });
  });

  it('changedKeys lists what applying the merge changes here', () => {
    const base: SyncEntries = { other: { value: 1, updatedAt: at(1) } };
    const merged: SyncEntries = {
      a: { value: 2, updatedAt: at(2) },
      other: { value: 5, updatedAt: at(2) },
      gone: { value: null, updatedAt: at(2), deleted: true },
      waits: { value: 1, updatedAt: at(2) },
    };
    const keys = changedKeys(
      base,
      merged,
      view({ a: 1, gone: 1 }, (key) => key !== 'other' && key !== 'waits'),
      (key) => key !== 'waits',
    );
    expect(keys.sort()).toEqual(['a', 'gone', 'other']);
  });
});
