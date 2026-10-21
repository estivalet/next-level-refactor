import {
  defaultSettings,
  ok,
  type IpcChannel,
  type IpcEvent,
  type IpcEventPayload,
  type IpcInput,
  type IpcOutput,
  type NextLevelBridge,
  type Result,
} from '@nextlevel/shared';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { setBridgeForTests } from './bridge.ts';
import { ShellProvider } from './features/shell/ShellContext.tsx';
import './i18n.ts';
import { createQueryClient } from './queryClient.ts';

/** Renders UI inside the same providers as main.tsx, with a fresh query client per test. */
export function renderInShell(ui: ReactNode) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <ShellProvider initialBounds={{ width: 1200, height: 800 }}>{ui}</ShellProvider>
    </QueryClientProvider>,
  );
}

type Responder<C extends IpcChannel> = (
  input: IpcInput<C>,
) => Result<IpcOutput<C>> | Promise<Result<IpcOutput<C>>>;
export type FakeResponses = { [C in IpcChannel]?: Responder<C> };

const DEFAULT_RESPONSES: FakeResponses = {
  'app.version': () => ok('0.0.0'),
  'settings.get': () => ok({ kind: 'ok', snapshot: { settings: defaultSettings(), revision: 0 } }),
  'settings.backups.list': () => ok([]),
};

/**
 * Installs a fake bridge for the test: channels answer from `responses` (falling back to sensible
 * defaults) and every call is recorded. Unanswered channels resolve INTERNAL.
 */
export function installFakeBridge(responses: FakeResponses = {}) {
  const calls: { channel: IpcChannel; input: unknown }[] = [];
  const all: FakeResponses = { ...DEFAULT_RESPONSES, ...responses };
  const invoke = ((channel: IpcChannel, input?: unknown) => {
    calls.push({ channel, input });
    const respond = all[channel] as ((input: unknown) => unknown) | undefined;
    if (!respond) {
      return Promise.resolve({
        ok: false,
        error: { code: 'INTERNAL', message: 'errors.internal' },
      });
    }
    return Promise.resolve(respond(input));
  }) as NextLevelBridge['invoke'];
  const listeners = new Map<IpcEvent, Set<(payload: unknown) => void>>();
  const on = ((event: IpcEvent, listener: (payload: unknown) => void) => {
    const set = listeners.get(event) ?? new Set();
    set.add(listener);
    listeners.set(event, set);
    return () => {
      set.delete(listener);
    };
  }) as NextLevelBridge['on'];
  setBridgeForTests({ invoke, on });
  /** Delivers a main → renderer event to the subscribed listeners. */
  const emit = <E extends IpcEvent>(event: E, payload: IpcEventPayload<E>) => {
    act(() => {
      for (const listener of listeners.get(event) ?? []) listener(payload);
    });
  };
  return { calls, channels: () => calls.map((call) => call.channel), emit };
}
