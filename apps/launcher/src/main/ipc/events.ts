import { eventChannel, ipcEvents, type IpcEvent, type IpcEventPayload } from '@nextlevel/shared';

/** Sends a main → renderer event to every window. */
export type EmitEvent = <E extends IpcEvent>(event: E, payload: IpcEventPayload<E>) => void;

export interface EventTarget {
  send(channel: string, payload: unknown): void;
}

/**
 * Validates each payload against the shared event schema, then sends it to every target. A
 * payload that breaks the contract is logged and never reaches the renderer.
 */
export function createEventSink(
  targets: () => readonly EventTarget[],
  log: { error(context: object, msg: string): void },
): EmitEvent {
  return (event, payload) => {
    const parsed = ipcEvents[event].safeParse(payload);
    if (!parsed.success) {
      log.error({ event, issues: parsed.error.issues }, 'event payload broke the contract');
      return;
    }
    for (const target of targets()) {
      // One closing window must not stop the event reaching the others.
      try {
        target.send(eventChannel(event), parsed.data);
      } catch (error) {
        log.error({ event, error }, 'could not send event');
      }
    }
  };
}
