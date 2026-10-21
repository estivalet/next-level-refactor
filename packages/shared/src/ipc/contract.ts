import { z } from 'zod';
import type { Result } from '../result.ts';
import { SystemDefinitionSchema } from '../catalog/schema.ts';
import { ScanStatusSchema, SystemSummarySchema } from '../library/schema.ts';
import { SettingsSchema } from '../settings/schema.ts';
import type { IpcEvent, IpcEventPayload } from './events.ts';
import { SettingsSnapshotSchema, type SettingsSnapshot } from './snapshot.ts';

export { SettingsSnapshotSchema, type SettingsSnapshot };

export const SettingsLoadSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ok'), snapshot: SettingsSnapshotSchema }),
  z.object({
    kind: z.literal('invalid'),
    reason: z.enum(['unreadable', 'invalid', 'newerVersion']),
    latestBackupId: z.string().nullable(),
  }),
]);

export const BackupInfoSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  size: z.number(),
  changes: z.array(z.string()),
});

export const APP_PATH_KEYS = ['data', 'backups', 'logs'] as const;

export type SettingsLoad = z.output<typeof SettingsLoadSchema>;
export type BackupInfo = z.output<typeof BackupInfoSchema>;
export type AppPathKey = (typeof APP_PATH_KEYS)[number];

/** Every IPC channel between renderer and main, with its input and output schemas. */
export const ipcContract = {
  'app.version': { input: z.void(), output: z.string() },
  'app.quit': { input: z.void(), output: z.void() },
  'app.paths': {
    input: z.void(),
    output: z.object({
      data: z.string(),
      settings: z.string(),
      backups: z.string(),
      logs: z.string(),
    }),
  },
  'app.openPath': { input: z.strictObject({ key: z.enum(APP_PATH_KEYS) }), output: z.void() },
  'app.pickFolder': {
    input: z.strictObject({ title: z.string().max(200).optional() }),
    output: z.string().nullable(),
  },
  'systems.catalog': { input: z.void(), output: z.array(SystemDefinitionSchema) },
  'systems.list': { input: z.void(), output: z.array(SystemSummarySchema) },
  'scan.start': {
    input: z.strictObject({ systemIds: z.array(z.string()).min(1).optional() }),
    output: ScanStatusSchema,
  },
  'scan.cancel': { input: z.void(), output: ScanStatusSchema },
  'scan.status': { input: z.void(), output: ScanStatusSchema },
  'settings.get': { input: z.void(), output: SettingsLoadSchema },
  'settings.save': {
    input: z.strictObject({ settings: SettingsSchema, baseRevision: z.number().int() }),
    output: SettingsSnapshotSchema,
  },
  'settings.reset': { input: z.void(), output: SettingsSnapshotSchema },
  'settings.backups.list': { input: z.void(), output: z.array(BackupInfoSchema) },
  'settings.backups.restore': {
    input: z.strictObject({ id: z.string() }),
    output: SettingsSnapshotSchema,
  },
  'settings.export': {
    input: z.void(),
    output: z.object({ status: z.enum(['saved', 'cancelled']) }),
  },
  'settings.import': {
    input: z.void(),
    output: z.discriminatedUnion('status', [
      z.object({ status: z.literal('cancelled') }),
      z.object({ status: z.literal('imported'), snapshot: SettingsSnapshotSchema }),
    ]),
  },
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
  /** Subscribes to a main → renderer event; returns the unsubscribe function. */
  on<E extends IpcEvent>(event: E, listener: (payload: IpcEventPayload<E>) => void): () => void;
}
