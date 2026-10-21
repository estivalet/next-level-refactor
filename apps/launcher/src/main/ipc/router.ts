import {
  AppErrorException,
  ERROR_CODES,
  err,
  ipcContract,
  ok,
  type IpcChannel,
  type IpcInput,
  type IpcOutput,
  type Result,
} from '@nextlevel/shared';

export type IpcHandlers = {
  [C in IpcChannel]: (input: IpcInput<C>) => Promise<IpcOutput<C>> | IpcOutput<C>;
};

export interface RouterLogger {
  error(context: Record<string, unknown>, msg: string): void;
}

export interface IpcRouter {
  channels: IpcChannel[];
  handle(channel: IpcChannel, rawInput: unknown): Promise<Result<unknown>>;
}

/**
 * Validates every call against the contract and turns every failure into a Result, so nothing
 * ever throws across the IPC bridge and no internal error text reaches the renderer.
 */
export function createIpcRouter(handlers: IpcHandlers, log: RouterLogger): IpcRouter {
  const channels = Object.keys(ipcContract) as IpcChannel[];

  async function handle(channel: IpcChannel, rawInput: unknown): Promise<Result<unknown>> {
    const { input: inputSchema, output: outputSchema } = ipcContract[channel];

    const input = inputSchema.safeParse(rawInput);
    if (!input.success) {
      return err('VALIDATION_FAILED', ERROR_CODES.VALIDATION_FAILED, input.error.issues);
    }

    let value: unknown;
    try {
      // The contract keys and the handler map share one mapped type, so the lookup is sound.
      const handler = handlers[channel] as (input: unknown) => unknown;
      value = await handler(input.data);
    } catch (error) {
      // An expected failure carried as an exception keeps its code (e.g. CONFLICT).
      if (error instanceof AppErrorException) return { ok: false, error: error.error };
      log.error({ channel, error }, 'IPC handler threw');
      return err('INTERNAL', ERROR_CODES.INTERNAL);
    }

    const output = outputSchema.safeParse(value);
    if (!output.success) {
      log.error({ channel, issues: output.error.issues }, 'IPC handler output broke the contract');
      return err('INTERNAL', ERROR_CODES.INTERNAL);
    }
    return ok(output.data);
  }

  return { channels, handle };
}
