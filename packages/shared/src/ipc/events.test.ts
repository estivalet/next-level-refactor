import { describe, expect, it } from 'vitest';
import { ipcContract } from './contract.ts';
import { eventChannel, ipcEvents, type IpcEvent } from './events.ts';

describe('ipcEvents', () => {
  it('FR-LIB-3: every event has a payload schema and an event: channel', () => {
    expect(eventChannel('scan.progress')).toBe('event:scan.progress');
    for (const event of Object.keys(ipcEvents) as IpcEvent[]) {
      expect(Object.hasOwn(ipcContract, event), event).toBe(false);
      expect(typeof ipcEvents[event].safeParse).toBe('function');
    }
    expect(ipcEvents['library.changed'].safeParse({ systems: ['nintendo-64'] }).success).toBe(true);
  });
});
