import { emptyPersonal, SystemPersonalSchema, type SystemPersonal } from '@nextlevel/shared';
import type { LibraryDb } from './openLibrary.ts';

/** The owner's notes and gallery per system (FR-MUS-6), kept apart from the museum entry. */
export class SystemPersonalRepository {
  constructor(
    private readonly db: LibraryDb,
    private readonly clock: () => Date,
  ) {}

  private get client() {
    return this.db.$client;
  }

  /** The stored record, or the empty one when missing or no longer valid. */
  get(systemId: string): SystemPersonal {
    return this.readStored(systemId) ?? emptyPersonal(systemId);
  }

  /**
   * The stored record (the empty one when there is no row), or null when a row exists but no
   * longer validates. Image pruning must not trust a record it could not read (FR-MUS-8).
   */
  readStored(systemId: string): SystemPersonal | null {
    const data = this.client
      .prepare('select data from system_personal where system_id = ?')
      .pluck()
      .get(systemId) as string | undefined;
    if (data === undefined) return emptyPersonal(systemId);
    try {
      const parsed = SystemPersonalSchema.safeParse(JSON.parse(data));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  /** Stores the record; an empty one (no notes, no images) deletes the row. */
  save(personal: SystemPersonal): SystemPersonal {
    const parsed = SystemPersonalSchema.parse(personal);
    if (parsed.notes === undefined && parsed.gallery.length === 0) {
      this.client.prepare('delete from system_personal where system_id = ?').run(parsed.systemId);
      return parsed;
    }
    this.client
      .prepare(
        `insert into system_personal (system_id, data, updated_at) values (?, ?, ?)
         on conflict(system_id) do update set data = excluded.data, updated_at = excluded.updated_at`,
      )
      .run(parsed.systemId, JSON.stringify(parsed), this.clock().toISOString());
    return parsed;
  }

  /** Which systems have a personal record, for the museum index (FR-MUS-9). */
  summary(): Map<string, { hasNotes: boolean; updatedAt: string }> {
    const rows = this.client
      .prepare('select system_id as id, data, updated_at as at from system_personal')
      .all() as Array<{ id: string; data: string; at: string }>;
    const out = new Map<string, { hasNotes: boolean; updatedAt: string }>();
    for (const row of rows) {
      const personal = this.get(row.id);
      if (personal.notes === undefined && personal.gallery.length === 0) continue;
      out.set(row.id, { hasNotes: personal.notes !== undefined, updatedAt: row.at });
    }
    return out;
  }
}
