import { z } from 'zod';
import type { Result } from '../result.ts';
import { EmulatorPresetSchema, SystemDefinitionSchema } from '../catalog/schema.ts';
import {
  LaunchLogPageSchema,
  LaunchOverrideSchema,
  LaunchPreviewSchema,
  LaunchStartedSchema,
  TestLaunchResultSchema,
} from '../launch/schema.ts';
import {
  COLLECTION_SORTS,
  CollectionNameSchema,
  CollectionSummarySchema,
} from '../library/collections.ts';
import {
  GameDetailsSchema,
  GameFlagsSchema,
  GameIdsSchema,
  GameListPageSchema,
  GameListQuerySchema,
  MetadataChangesSchema,
  SearchResultSchema,
} from '../library/games.ts';
import { ScanStatusSchema, SystemSummarySchema } from '../library/schema.ts';
import { EmulatorProfileSchema, EmulatorSchema } from '../settings/emulators.ts';
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

const gameId = z.number().int().positive();
const collectionId = z.number().int().positive();

/** A profile from Settings, saved or not, for Preview and Test launch (FR-EMU-5). */
function launchDraft<G extends z.ZodType>(game: G) {
  return z
    .strictObject({ emulator: EmulatorSchema, profile: EmulatorProfileSchema, gameId: game })
    .refine((draft) => draft.profile.emulatorId === draft.emulator.id, {
      message: 'unknownEmulator',
      path: ['profile', 'emulatorId'],
    });
}

export const DetectedEmulatorSchema = z.object({ presetId: z.string(), executable: z.string() });
export type DetectedEmulator = z.output<typeof DetectedEmulatorSchema>;

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
  'app.pickFile': {
    input: z.strictObject({ title: z.string().max(200).optional(), kind: z.literal('executable') }),
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
  'library.games.list': { input: GameListQuerySchema, output: GameListPageSchema },
  'library.games.get': { input: z.strictObject({ gameId }), output: GameDetailsSchema },
  'library.games.updateMetadata': {
    input: z.strictObject({ gameId, changes: MetadataChangesSchema }),
    output: GameDetailsSchema,
  },
  'library.games.setFlags': {
    input: z.strictObject({ gameIds: GameIdsSchema, flags: GameFlagsSchema }),
    output: z.void(),
  },
  'library.games.relink': {
    input: z.strictObject({ missingGameId: gameId, replacementGameId: gameId }),
    output: GameDetailsSchema,
  },
  'library.games.reveal': { input: z.strictObject({ gameId }), output: z.void() },
  'library.search': {
    input: z.strictObject({
      text: z.string().max(200),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    output: SearchResultSchema,
  },
  'library.games.launchOverride': {
    input: z.strictObject({ gameId }),
    output: LaunchOverrideSchema,
  },
  'library.games.setLaunchOverride': {
    input: z.strictObject({ gameId, override: LaunchOverrideSchema }),
    output: LaunchOverrideSchema,
  },
  'launch.game': {
    input: z.strictObject({ gameId }),
    output: z.object({ launchId: z.number().int().positive() }),
  },
  'launch.test': { input: launchDraft(gameId), output: TestLaunchResultSchema },
  'launch.preview': { input: launchDraft(gameId.optional()), output: LaunchPreviewSchema },
  'launch.log': {
    input: z.strictObject({
      offset: z.number().int().min(0),
      limit: z.number().int().min(1).max(200),
    }),
    output: LaunchLogPageSchema,
  },
  'launch.running': { input: z.void(), output: LaunchStartedSchema.nullable() },
  'emulators.presets': { input: z.void(), output: z.array(EmulatorPresetSchema) },
  'emulators.detect': {
    input: z.strictObject({ folder: z.string().trim().min(3).max(500) }),
    output: z.array(DetectedEmulatorSchema),
  },
  'collections.list': { input: z.void(), output: z.array(CollectionSummarySchema) },
  'collections.create': {
    input: z.strictObject({ name: CollectionNameSchema }),
    output: CollectionSummarySchema,
  },
  'collections.update': {
    input: z.strictObject({
      id: collectionId,
      name: CollectionNameSchema.optional(),
      sort: z.enum(COLLECTION_SORTS).optional(),
    }),
    output: CollectionSummarySchema,
  },
  'collections.delete': { input: z.strictObject({ id: collectionId }), output: z.void() },
  'collections.addGames': {
    input: z.strictObject({ id: collectionId, gameIds: GameIdsSchema }),
    output: CollectionSummarySchema,
  },
  'collections.removeGames': {
    input: z.strictObject({ id: collectionId, gameIds: GameIdsSchema }),
    output: CollectionSummarySchema,
  },
  'collections.reorder': {
    // Swaps two members, so a move works on the rows the user sees whatever is filtered out.
    input: z.strictObject({ id: collectionId, gameId, swapWithGameId: gameId }),
    output: z.void(),
  },
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
