import {
  AppErrorException,
  SYNC_MAX_BYTES,
  SyncDataSchema,
  SyncDocumentSchema,
  SyncPutResponseSchema,
  SyncStoreSchema,
  type AuthState,
  type Settings,
  type SyncDocument,
  type SyncEntries,
  type SyncError,
  type SyncKind,
  type SyncKindState,
  type SyncState,
  type SyncStore,
} from '@nextlevel/shared';
import { readFile } from 'node:fs/promises';
import type { ApiClient } from '../auth/ApiClient.ts';
import { atomicWrite } from '../fs/atomicWrite.ts';
import type { KindAdapter } from './documents.ts';
import { changedKeys, clampEntries, mergeEntries, sameEntries, stampLocal } from './merge.ts';

export const SYNC_EVERY_MS = 60 * 60_000;
export const SYNC_DEBOUNCE_MS = 10_000;

/** Kinds in sync order: menus after collections, so every collection a menu names exists. */
export const SYNC_ORDER: readonly SyncKind[] = ['settings', 'collections', 'userState', 'menus'];

type SyncSection = Settings['sync'];

export interface SyncDeps {
  api: Pick<ApiClient, 'request'>;
  auth: {
    accessCall<T>(call: (token: string) => Promise<T>): Promise<T>;
    state(): AuthState;
    onChecked(listener: () => void): () => void;
  };
  /** settings.sync now, and main's write of it (the section is main-owned). */
  section: () => SyncSection;
  writeSection: (section: SyncSection) => Promise<void>;
  /** The kinds this PC can sync now (no library → settings only). */
  kinds: () => Partial<Record<SyncKind, KindAdapter>>;
  /** `<data>\sync.json`. */
  file: string;
  /** atomicWrite; injected so a failing disk can be tested. */
  write?: (file: string, data: string) => Promise<void>;
  newId: () => string;
  clock: () => Date;
  every: (ms: number, run: () => void) => () => void;
  after: (ms: number, run: () => void) => () => void;
  emit: (state: SyncState) => void;
  log: { warn(context: object, msg: string): void };
}

class DeletedElsewhere extends Error {}
class StillConflicting extends Error {}

const EMPTY_STORE: SyncStore = { v: 1, userId: null, lastSync: null, kinds: {} };

function errorOf(error: unknown): SyncError {
  if (error instanceof DeletedElsewhere) return 'deletedElsewhere';
  if (error instanceof StillConflicting) return 'conflict';
  if (!(error instanceof AppErrorException)) return 'other';
  switch (error.error.code) {
    case 'API_UNREACHABLE':
    case 'UNAUTHENTICATED':
      return 'offline';
    case 'SUBSCRIPTION_REQUIRED':
    case 'SUSPENDED':
      return 'subscription';
    case 'PAYLOAD_TOO_LARGE':
      return 'tooLarge';
    case 'CONFLICT':
      return 'conflict';
    default:
      return 'other';
  }
}

/**
 * Settings sync (FR-SET-5, D55): opt-in per PC for signed-in subscribers. For each kind: pull
 * the account's document, merge it entry by entry with what changed here, apply the result here,
 * and push it when it differs (a 409 pulls, merges and retries once). Runs at start (the first
 * entitlement check), 10 s after a change, hourly, and on Sync now.
 */
export class SyncService {
  readonly #deps: SyncDeps;
  #store: SyncStore | null = null;
  #running: Promise<SyncState> | null = null;
  #again = false;
  #syncing = false;
  #error: SyncError | null = null;
  #stops: Array<() => void> = [];
  #cancelDebounce: (() => void) | null = null;

  constructor(deps: SyncDeps) {
    this.#deps = deps;
  }

  state(): SyncState {
    return {
      enabled: this.#deps.section().enabled,
      lastSync: this.#store?.lastSync ?? null,
      syncing: this.#syncing,
      error: this.#error,
    };
  }

  /** Hourly, and once after the first entitlement check of this run (boot). */
  async start(): Promise<void> {
    await this.#load();
    this.#stops.push(this.#deps.every(SYNC_EVERY_MS, () => void this.sync()));
    let booted = false;
    this.#stops.push(
      this.#deps.auth.onChecked(() => {
        if (booted) return;
        booted = true;
        void this.sync();
      }),
    );
  }

  dispose(): void {
    for (const stop of this.#stops) stop();
    this.#stops = [];
    this.#cancelDebounce?.();
  }

  /** Something syncable changed here: sync 10 s after the last such change. */
  notify(): void {
    if (!this.#deps.section().enabled) return;
    this.#cancelDebounce?.();
    this.#cancelDebounce = this.#deps.after(SYNC_DEBOUNCE_MS, () => {
      this.#cancelDebounce = null;
      void this.sync();
    });
  }

  async setEnabled(enabled: boolean): Promise<SyncState> {
    const section = this.#deps.section();
    await this.#deps.writeSection({
      enabled,
      // Created once, the first time sync is turned on: it names this PC's play counters.
      deviceKey: section.deviceKey ?? (enabled ? this.#deps.newId() : null),
    });
    this.#error = null;
    if (!enabled) {
      this.#cancelDebounce?.();
      return this.#announce();
    }
    return this.sync();
  }

  /** Delete synced data: the account's documents go, and sync turns off on this PC. */
  async deleteRemote(): Promise<SyncState> {
    await this.#deps.auth.accessCall((access) =>
      this.#deps.api.request('DELETE', '/v1/sync', null, { access }),
    );
    await this.#forget();
    await this.#deps.writeSection({ ...this.#deps.section(), enabled: false });
    this.#error = null;
    return this.#announce();
  }

  /** One sync of every kind; a call while one runs waits for it and then runs once more. */
  sync(): Promise<SyncState> {
    if (this.#running) {
      this.#again = true;
      return this.#running;
    }
    this.#running = this.#run().finally(() => {
      this.#running = null;
      if (this.#again) {
        this.#again = false;
        void this.sync();
      }
    });
    return this.#running;
  }

  async #run(): Promise<SyncState> {
    const auth = this.#deps.auth.state();
    if (!this.#deps.section().enabled || auth.kind !== 'signedIn') return this.state();
    this.#syncing = true;
    this.#announce();
    try {
      const store = await this.#load();
      if (store.userId !== auth.user.id) {
        // Another account on this PC: nothing merged for the previous one carries over.
        store.userId = auth.user.id;
        store.kinds = {};
      }
      const kinds = this.#deps.kinds();
      for (const kind of SYNC_ORDER) {
        const adapter = kinds[kind];
        if (!adapter) continue;
        store.kinds[kind] = await this.#syncKind(kind, adapter, store.kinds[kind] ?? null);
        await this.#save();
      }
      store.lastSync = this.#deps.clock().toISOString();
      await this.#save();
      this.#error = null;
    } catch (error) {
      this.#error = errorOf(error);
      if (error instanceof DeletedElsewhere) {
        await this.#forget();
        await this.#deps.writeSection({ ...this.#deps.section(), enabled: false });
      } else if (this.#error === 'other') {
        this.#deps.log.warn({ error }, 'settings sync failed');
      }
    } finally {
      this.#syncing = false;
    }
    return this.#announce();
  }

  async #syncKind(
    kind: SyncKind,
    adapter: KindAdapter,
    stored: SyncKindState | null,
  ): Promise<SyncKindState> {
    const path = `/v1/sync/${kind}`;
    let doc: SyncDocument = await this.#deps.auth.accessCall((access) =>
      this.#deps.api.request('GET', path, SyncDocumentSchema, { access }),
    );
    let base = stored;
    for (let attempt = 0; ; attempt += 1) {
      // Delete synced data on another PC: this PC's copy must not bring it all back.
      if (doc.data === null && doc.revision > 0 && base && base.revision > 0) {
        throw new DeletedElsewhere();
      }
      const remote = clampEntries(
        doc.data === null ? {} : SyncDataSchema.parse(doc.data).entries,
        doc.updatedAt,
      );
      const now = this.#deps.clock();
      const baseEntries = base?.entries ?? {};
      const read = adapter.read(baseEntries, remote);
      const local = stampLocal(baseEntries, new Set(base?.held), read.view, now, base === null);
      const merged = mergeEntries(local, remote, now);
      await adapter.apply(merged, changedKeys(baseEntries, merged, read.view, read.present), read);
      base = { revision: doc.revision, entries: merged, held: held(merged, read) };
      if (sameEntries(merged, remote)) return base;
      const data = { v: 1 as const, entries: merged };
      if (JSON.stringify({ baseRevision: doc.revision, data }).length > SYNC_MAX_BYTES) {
        throw new AppErrorException({
          code: 'PAYLOAD_TOO_LARGE',
          message: 'errors.payloadTooLarge',
        });
      }
      try {
        const written = await this.#deps.auth.accessCall((access) =>
          this.#deps.api.request('PUT', path, SyncPutResponseSchema, {
            access,
            body: { baseRevision: doc.revision, data },
          }),
        );
        return { ...base, revision: written.revision };
      } catch (error) {
        const newer =
          error instanceof AppErrorException && error.error.code === 'CONFLICT'
            ? SyncDocumentSchema.safeParse(error.error.details)
            : null;
        if (!newer?.success) throw error;
        if (attempt > 0) throw new StillConflicting();
        doc = newer.data;
      }
    }
  }

  /**
   * After a delete: only the other PCs' play counters stay, so this PC's own share is still
   * told apart from theirs (its totals include them) if sync is turned on again.
   */
  async #forget(): Promise<void> {
    const store = await this.#load();
    const key = this.#deps.section().deviceKey;
    const userState = store.kinds.userState;
    const others: SyncEntries = {};
    for (const [entryKey, entry] of Object.entries(userState?.entries ?? {})) {
      if (entryKey.startsWith('p:') && !entryKey.startsWith(`p:${key ?? ''}|`)) {
        others[entryKey] = entry;
      }
    }
    store.kinds = userState
      ? { userState: { revision: 0, entries: others, held: userState.held } }
      : {};
    await this.#save();
  }

  async #load(): Promise<SyncStore> {
    if (this.#store) return this.#store;
    try {
      const parsed = SyncStoreSchema.safeParse(JSON.parse(await readFile(this.#deps.file, 'utf8')));
      this.#store = parsed.success ? parsed.data : structuredClone(EMPTY_STORE);
      if (!parsed.success) this.#deps.log.warn({}, 'sync.json is not usable; starting over');
    } catch {
      this.#store = structuredClone(EMPTY_STORE);
    }
    return this.#store;
  }

  /**
   * Saves progress. A failed write (a locked file) never fails the sync: the copy in memory is
   * current, and the next save writes it.
   */
  async #save(): Promise<void> {
    if (!this.#store) return;
    try {
      await (this.#deps.write ?? atomicWrite)(this.#deps.file, JSON.stringify(this.#store));
    } catch (error) {
      this.#deps.log.warn({ code: (error as NodeJS.ErrnoException).code }, 'sync.json not saved');
    }
  }

  #announce(): SyncState {
    const state = this.state();
    this.#deps.emit(state);
    return state;
  }
}

/** The games the merged document is about that this PC has. */
function held(merged: SyncEntries, read: ReturnType<KindAdapter['read']>): string[] {
  const subjects = new Set<string>();
  for (const key of Object.keys(merged)) {
    const subject = read.view.subject(key);
    if (subject !== null && read.hasSubject(subject)) subjects.add(subject);
  }
  return [...subjects];
}
