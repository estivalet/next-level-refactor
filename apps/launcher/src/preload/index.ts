import { ERROR_CODES, err, eventChannel, ipcContract, ipcEvents } from '@nextlevel/shared';
import type { IpcChannel, NextLevelBridge } from '@nextlevel/shared';
import { contextBridge, ipcRenderer } from 'electron';

// ipcRenderer.invoke is untyped; the contract type is applied once here, and main validates
// every call against the same contract. Unknown channels never reach main.
const invoke = ((channel: IpcChannel, ...args: unknown[]) =>
  Object.hasOwn(ipcContract, channel)
    ? ipcRenderer.invoke(channel, ...args)
    : Promise.resolve(
        err('VALIDATION_FAILED', ERROR_CODES.VALIDATION_FAILED, { reason: 'unknown channel' }),
      )) as NextLevelBridge['invoke'];

// Only known events are subscribed; main validates every payload before sending it.
const on: NextLevelBridge['on'] = (event, listener) => {
  if (!Object.hasOwn(ipcEvents, event)) return () => undefined;
  const channel = eventChannel(event);
  const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => {
    listener(payload as Parameters<typeof listener>[0]);
  };
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
};

const bridge: NextLevelBridge = { invoke, on };

contextBridge.exposeInMainWorld('nextlevel', bridge);
