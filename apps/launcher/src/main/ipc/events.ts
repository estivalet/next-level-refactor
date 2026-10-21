import type { IpcEvent, IpcEventPayload } from '@nextlevel/shared';

/** Sends a main → renderer event to every window. */
export type EmitEvent = <E extends IpcEvent>(event: E, payload: IpcEventPayload<E>) => void;
