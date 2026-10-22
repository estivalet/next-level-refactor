import type { IpcEvent, MenuDraft } from '@nextlevel/shared';
import { v7 as uuidv7 } from 'uuid';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appErrorOf, tempLibrary } from '../library/testing.ts';
import { createMenuHandlers } from './menuHandlers.ts';
import { MenuRepository } from './MenuRepository.ts';

let library: Awaited<ReturnType<typeof tempLibrary>>;
let menus: MenuRepository;
let events: IpcEvent[];
let handlers: ReturnType<typeof createMenuHandlers>;
const generated: MenuDraft = { title: 'Default', nodes: [] };

beforeEach(async () => {
  library = await tempLibrary();
  menus = new MenuRepository(library.db, () => new Date(Date.UTC(2026, 9, 22)), uuidv7);
  events = [];
  handlers = createMenuHandlers({
    menus: () => menus,
    generatedDraft: () => generated,
    newId: () => '0199f000-0000-7000-8000-000000000001',
    emit: (event) => {
      events.push(event);
    },
  });
});
afterEach(async () => {
  await library.cleanup();
});

describe('menu handlers (FR-MENU-1, FR-MENU-3)', () => {
  it('FR-MENU-3: with no menus the draft is the generated one, unsaved', async () => {
    expect(await handlers['menus.draft']()).toEqual({
      ...generated,
      id: '0199f000-0000-7000-8000-000000000001',
      revision: 0,
      active: true,
      source: null,
    });
    expect(await handlers['menus.generated']()).toBe(generated);
    expect(events).toEqual([]);
  });

  it('FR-MENU-1: create, save, activate and delete each announce menus.changed', async () => {
    const first = await handlers['menus.create']({ title: 'Main', nodes: [] });
    const second = await handlers['menus.create']({ title: 'Kids', nodes: [] });
    expect(await handlers['menus.draft']()).toMatchObject({ id: first.id });
    await handlers['menus.save']({ id: first.id, title: 'Mine', nodes: [], baseRevision: 0 });
    await handlers['menus.setActive']({ id: second.id });
    await handlers['menus.delete']({ id: first.id });
    expect(events).toEqual(Array(5).fill('menus.changed'));
    expect((await handlers['menus.list']()).map((menu) => menu.title)).toEqual(['Kids']);
    expect(await handlers['menus.get']({ id: second.id })).toMatchObject({ active: true });
  });

  it('US-D5: a save from an old revision is CONFLICT and announces nothing', async () => {
    const menu = await handlers['menus.create']({ title: 'Main', nodes: [] });
    await handlers['menus.save']({ id: menu.id, title: 'A', nodes: [], baseRevision: 0 });
    events.length = 0;
    const save = () =>
      handlers['menus.save']({ id: menu.id, title: 'B', nodes: [], baseRevision: 0 });
    expect(appErrorOf(save).code).toBe('CONFLICT');
    expect(events).toEqual([]);
  });
});
