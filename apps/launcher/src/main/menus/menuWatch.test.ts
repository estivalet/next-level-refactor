import { describe, expect, it, vi } from 'vitest';
import type { EmitEvent } from '../ipc/events.ts';
import { createMenuWatch } from './menuWatch.ts';

function setup(initial = 'a') {
  const sent: string[] = [];
  const inner: EmitEvent = (event) => {
    sent.push(event);
  };
  const log = { warn: vi.fn() };
  let value = initial;
  const watch = createMenuWatch(inner, log);
  return {
    sent,
    log,
    watch,
    set: (next: string) => {
      value = next;
    },
    start: () => {
      watch.watch(() => value);
    },
  };
}

describe('createMenuWatch', () => {
  it('FR-MENU-2: announces menus.changed once when a game change moves the fingerprint', () => {
    const { sent, watch, set, start } = setup();
    start();
    set('b');
    watch.emit('library.changed', { systems: ['snes'], gameIds: [1] });
    watch.emit('library.changed', { systems: ['snes'], gameIds: [1] });
    expect(sent).toEqual(['library.changed', 'menus.changed', 'library.changed']);
  });

  it('FR-MENU-3: a settings change that moves it (system enabled) announces too', () => {
    const { sent, watch, set, start } = setup();
    start();
    set('b');
    watch.emit('settings.changed', { settings: {} as never, revision: 1 });
    expect(sent).toEqual(['settings.changed', 'menus.changed']);
  });

  it('stays quiet when nothing the menu shows moved', () => {
    const { sent, watch, start } = setup();
    start();
    watch.emit('library.changed', { systems: ['snes'] });
    expect(sent).toEqual(['library.changed']);
  });

  it('a menus.changed from elsewhere becomes the new baseline', () => {
    const { sent, watch, set, start } = setup();
    start();
    set('b');
    watch.emit('menus.changed', {});
    watch.emit('library.changed', { systems: ['snes'] });
    expect(sent).toEqual(['menus.changed', 'library.changed']);
  });

  it('does nothing before it watches, and logs a fingerprint that throws', () => {
    const { sent, watch, log } = setup();
    watch.emit('library.changed', { systems: ['snes'] });
    watch.watch(() => {
      throw new Error('db closed');
    });
    watch.emit('library.changed', { systems: ['snes'] });
    expect(sent).toEqual(['library.changed', 'library.changed']);
    expect(log.warn).toHaveBeenCalled();
  });
});
