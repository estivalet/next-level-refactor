import type { IpcChannel, NextLevelBridge } from '@nextlevel/shared';
import { contextBridge, ipcRenderer } from 'electron';

// ipcRenderer.invoke is untyped; the contract type is applied once here, and main validates
// every call against the same contract.
const invoke = ((channel: IpcChannel, ...args: unknown[]) =>
  ipcRenderer.invoke(channel, ...args)) as NextLevelBridge['invoke'];

const bridge: NextLevelBridge = { invoke };

contextBridge.exposeInMainWorld('nextlevel', bridge);
