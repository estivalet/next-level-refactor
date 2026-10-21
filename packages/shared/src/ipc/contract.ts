import { z } from 'zod';
import type { Result } from '../result.ts';

/** Every IPC channel between renderer and main, with its input and output schemas. */
export const ipcContract = {
  'app.version': { input: z.void(), output: z.string() },
} as const;

export type IpcContract = typeof ipcContract;
export type IpcChannel = keyof IpcContract;
export type IpcInput<C extends IpcChannel> = z.infer<IpcContract[C]['input']>;
export type IpcOutput<C extends IpcChannel> = z.infer<IpcContract[C]['output']>;

/** The bridge the preload exposes as `window.nextlevel`. */
export interface NextLevelBridge {
  invoke<C extends IpcChannel>(
    channel: C,
    ...args: undefined extends IpcInput<C> ? [input?: IpcInput<C>] : [input: IpcInput<C>]
  ): Promise<Result<IpcOutput<C>>>;
}
