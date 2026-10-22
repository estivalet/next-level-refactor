import type { IpcEvent } from '@nextlevel/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSmartFilterHandlers } from './smartFilterHandlers.ts';
import { SmartFilterRepository } from './SmartFilterRepository.ts';
import { appErrorOf, tempLibrary } from './testing.ts';

let library: Awaited<ReturnType<typeof tempLibrary>>;
let events: IpcEvent[];
let handlers: ReturnType<typeof createSmartFilterHandlers>;

beforeEach(async () => {
  library = await tempLibrary();
  const repo = new SmartFilterRepository(library.db, () => new Date(Date.UTC(2026, 9, 22)));
  events = [];
  handlers = createSmartFilterHandlers({
    smartFilters: () => repo,
    emit: (event) => {
      events.push(event);
    },
  });
});
afterEach(async () => {
  await library.cleanup();
});

const query = { systems: [], played: 'any' as const, sort: 'title' as const };

describe('smart filter handlers (FR-LIB-9)', () => {
  it('every write announces menus.changed; reads do not', async () => {
    const created = await handlers['smartFilters.create']({ name: 'Picks', query });
    await handlers['smartFilters.update']({ id: created.id, name: 'Best' });
    expect((await handlers['smartFilters.list']()).map((filter) => filter.name)).toEqual(['Best']);
    await handlers['smartFilters.delete']({ id: created.id });
    expect(events).toEqual(['menus.changed', 'menus.changed', 'menus.changed']);
  });

  it('a refused write announces nothing', async () => {
    await handlers['smartFilters.create']({ name: 'Picks', query });
    events.length = 0;
    const duplicate = () => handlers['smartFilters.create']({ name: 'picks', query });
    expect(appErrorOf(duplicate).code).toBe('NAME_TAKEN');
    expect(appErrorOf(() => handlers['smartFilters.delete']({ id: 99 })).code).toBe('NOT_FOUND');
    expect(events).toEqual([]);
  });
});
