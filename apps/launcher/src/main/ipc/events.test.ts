import { describe, expect, it, vi } from 'vitest';
import { createEventSink } from './events.ts';

describe('createEventSink', () => {
  it('FR-LIB-3: sends valid payloads to every window on the event: channel', () => {
    const first = { send: vi.fn() };
    const second = { send: vi.fn() };
    const emit = createEventSink(() => [first, second], { error: vi.fn() });
    emit('library.changed', { systems: ['nintendo-64'] });
    expect(first.send).toHaveBeenCalledWith('event:library.changed', { systems: ['nintendo-64'] });
    expect(second.send).toHaveBeenCalledWith('event:library.changed', { systems: ['nintendo-64'] });
  });

  it('FR-LIB-3: the event sink keeps sending when one window fails', () => {
    const broken = {
      send: vi.fn(() => {
        throw new Error('destroyed');
      }),
    };
    const working = { send: vi.fn() };
    const error = vi.fn();
    const emit = createEventSink(() => [broken, working], { error });
    emit('library.changed', { systems: [] });
    expect(working.send).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
  });

  it('FR-LIB-3: the event sink drops payloads that break the contract', () => {
    const target = { send: vi.fn() };
    const error = vi.fn();
    const emit = createEventSink(() => [target], { error });
    emit('library.changed', { systems: 'nintendo-64' } as never);
    expect(target.send).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
  });
});
