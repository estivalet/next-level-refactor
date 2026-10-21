import { ERROR_CODES, err, ipcContract } from '@nextlevel/shared';
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

const bridge: NextLevelBridge = { invoke };

contextBridge.exposeInMainWorld('nextlevel', bridge);
