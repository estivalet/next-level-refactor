import type { Device, DeviceInfo } from '@nextlevel/shared';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { ApiDb } from '../db/open.ts';
import { devices } from '../db/schema.ts';

export type DeviceRow = typeof devices.$inferSelect;

/** The API shape of a device row; `current` marks the device making the request. */
export function toDevice(row: DeviceRow, currentId: string | null): Device {
  return {
    id: row.id,
    name: row.name,
    platform: row.platform,
    appVersion: row.appVersion,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
    revokedAt: row.revokedAt,
    current: row.id === currentId,
  };
}

/** The `devices` table (data model §5, FR-AUTH-8). */
export class DeviceRepository {
  readonly #db: ApiDb;
  readonly #newId: () => string;

  constructor(db: ApiDb, newId: () => string) {
    this.#db = db;
    this.#newId = newId;
  }

  create(userId: string, info: DeviceInfo, now: Date): DeviceRow {
    const at = now.toISOString();
    const row: DeviceRow = {
      id: this.#newId(),
      userId,
      name: info.name,
      platform: info.platform,
      appVersion: info.appVersion,
      createdAt: at,
      lastSeenAt: at,
      revokedAt: null,
    };
    this.#db.insert(devices).values(row).run();
    return row;
  }

  byId(id: string): DeviceRow | undefined {
    return this.#db.select().from(devices).where(eq(devices.id, id)).get();
  }

  /** Devices not revoked, oldest first. */
  active(userId: string): DeviceRow[] {
    return this.#db
      .select()
      .from(devices)
      .where(and(eq(devices.userId, userId), isNull(devices.revokedAt)))
      .orderBy(asc(devices.createdAt), asc(devices.id))
      .all();
  }

  /** Every device, revoked ones included, oldest first. */
  all(userId: string): DeviceRow[] {
    return this.#db
      .select()
      .from(devices)
      .where(eq(devices.userId, userId))
      .orderBy(asc(devices.createdAt), asc(devices.id))
      .all();
  }

  touch(id: string, now: Date, appVersion?: string): void {
    this.#db
      .update(devices)
      .set({ lastSeenAt: now.toISOString(), ...(appVersion ? { appVersion } : {}) })
      .where(eq(devices.id, id))
      .run();
  }
}
