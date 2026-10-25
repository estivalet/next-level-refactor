import { eq } from 'drizzle-orm';
import type { GoogleIdentity } from '../auth/identity.ts';
import type { ApiDb } from '../db/open.ts';
import { users } from '../db/schema.ts';

export type UserRow = typeof users.$inferSelect;
export type Role = UserRow['role'];
export type UserStatus = UserRow['status'];

/** The `users` table (data model §5). Profile fields come from Google at each sign-in. */
export class UserRepository {
  readonly #db: ApiDb;
  readonly #newId: () => string;

  constructor(db: ApiDb, newId: () => string) {
    this.#db = db;
    this.#newId = newId;
  }

  byId(id: string): UserRow | undefined {
    return this.#db.select().from(users).where(eq(users.id, id)).get();
  }

  byGoogleSub(sub: string): UserRow | undefined {
    return this.#db.select().from(users).where(eq(users.googleSub, sub)).get();
  }

  create(identity: GoogleIdentity, role: Role, status: UserStatus, now: Date): UserRow {
    const row: UserRow = {
      id: this.#newId(),
      googleSub: identity.sub,
      email: identity.email,
      name: identity.name,
      avatarUrl: identity.avatarUrl,
      role,
      status,
      suspendedReason: null,
      createdAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
    };
    this.#db.insert(users).values(row).run();
    return row;
  }

  /** Google is the source of the profile (security §5 Correction). */
  updateProfile(id: string, identity: GoogleIdentity, now: Date): UserRow {
    this.#db
      .update(users)
      .set({
        email: identity.email,
        name: identity.name,
        avatarUrl: identity.avatarUrl,
        lastSeenAt: now.toISOString(),
      })
      .where(eq(users.id, id))
      .run();
    const row = this.byId(id);
    if (!row) throw new Error(`user ${id} vanished`);
    return row;
  }

  touch(id: string, now: Date): void {
    this.#db.update(users).set({ lastSeenAt: now.toISOString() }).where(eq(users.id, id)).run();
  }
}
