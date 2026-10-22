import { z } from 'zod';
import { LaunchFinishedSchema, LaunchStartedSchema } from '../launch/schema.ts';
import { ScanProgressSchema, ScanSummarySchema } from '../library/schema.ts';
import { SettingsSnapshotSchema } from './snapshot.ts';

/** Every event main sends to the renderer, with its payload schema. */
export const ipcEvents = {
  'scan.progress': ScanProgressSchema,
  'scan.finished': ScanSummarySchema,
  'settings.changed': SettingsSnapshotSchema,
  'library.changed': z.object({
    systems: z.array(z.string()),
    /** The games a metadata or flag change touched; absent after a scan. */
    gameIds: z.array(z.number().int().positive()).optional(),
  }),
  'launch.started': LaunchStartedSchema,
  'launch.finished': LaunchFinishedSchema,
} as const;

export type IpcEvent = keyof typeof ipcEvents;
export type IpcEventPayload<E extends IpcEvent> = z.output<(typeof ipcEvents)[E]>;

/** The wire channel of an event; prefixed so it can never collide with an invoke channel. */
export function eventChannel(event: IpcEvent): string {
  return `event:${event}`;
}
