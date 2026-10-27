import type { TokenPair } from '@nextlevel/shared';
import { and, eq, inArray, isNull, lt } from 'drizzle-orm';
import type { ApiDb } from '../db/open.ts';
import { devices, refreshTokens, users } from '../db/schema.ts';
import { apiError } from '../errors.ts';
import { hashToken, newRefreshToken, REFRESH_TTL_MS, signAccess, type JwtKeys } from './tokens.ts';

/**
 * Launcher sessions (ADR-006, C7): one refresh-token chain per device. Each use rotates the
 * token; presenting a token that was already rotated means it was copied, so the whole device
 * is revoked.
 */
export class TokenService {
  readonly #deps: { db: ApiDb; keys: JwtKeys; clock: () => Date; newId: () => string };

  constructor(deps: { db: ApiDb; keys: JwtKeys; clock: () => Date; newId: () => string }) {
    this.#deps = deps;
  }

  /** A first pair for a device that was just created. */
  async issue(deviceId: string): Promise<TokenPair> {
    const now = this.#deps.clock();
    this.#prune(now);
    const refreshToken = this.#insert(deviceId, now);
    return { accessToken: await this.#access(deviceId, now), refreshToken };
  }

  async rotate(refreshToken: string, deviceId: string): Promise<TokenPair> {
    const { db, clock } = this.#deps;
    const now = clock();
    const outcome = db.transaction((tx) => {
      const row = tx
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, hashToken(refreshToken)))
        .get();
      if (!row || row.deviceId !== deviceId) return { kind: 'refused' as const };
      const device = tx.select().from(devices).where(eq(devices.id, deviceId)).get();
      if (!device || device.revokedAt !== null) return { kind: 'refused' as const };
      if (row.replacedBy !== null || row.revokedAt !== null) return { kind: 'reused' as const };
      if (Date.parse(row.expiresAt) <= now.getTime()) return { kind: 'refused' as const };
      const next = this.#insert(deviceId, now, tx);
      const nextId = tx
        .select({ id: refreshTokens.id })
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, hashToken(next)))
        .get();
      tx.update(refreshTokens)
        .set({ replacedBy: nextId?.id ?? null })
        .where(eq(refreshTokens.id, row.id))
        .run();
      tx.update(devices)
        .set({ lastSeenAt: now.toISOString() })
        .where(eq(devices.id, deviceId))
        .run();
      return { kind: 'rotated' as const, refreshToken: next };
    });
    if (outcome.kind === 'reused') this.revokeDevice(deviceId);
    if (outcome.kind !== 'rotated') throw apiError('UNAUTHENTICATED');
    return { accessToken: await this.#access(deviceId, now), refreshToken: outcome.refreshToken };
  }

  /** Signs the device out everywhere: the device and every token of it. */
  revokeDevice(deviceId: string): void {
    const at = this.#deps.clock().toISOString();
    this.#deps.db.transaction((tx) => {
      tx.update(devices)
        .set({ revokedAt: at })
        .where(and(eq(devices.id, deviceId), isNull(devices.revokedAt)))
        .run();
      tx.update(refreshTokens)
        .set({ revokedAt: at })
        .where(and(eq(refreshTokens.deviceId, deviceId), isNull(refreshTokens.revokedAt)))
        .run();
    });
  }

  /**
   * Drops tokens that can no longer matter: expired over a day ago, or of a device revoked over
   * a day ago. Rotated tokens stay until they expire, so presenting one is still caught as reuse.
   */
  #prune(now: Date): void {
    const dayAgo = new Date(now.getTime() - 24 * 3600_000).toISOString();
    const { db } = this.#deps;
    const revoked = db
      .select({ id: devices.id })
      .from(devices)
      .where(lt(devices.revokedAt, dayAgo));
    db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, dayAgo)).run();
    db.delete(refreshTokens).where(inArray(refreshTokens.deviceId, revoked)).run();
  }

  #insert(deviceId: string, now: Date, tx: Pick<ApiDb, 'insert'> = this.#deps.db): string {
    const token = newRefreshToken();
    tx.insert(refreshTokens)
      .values({
        id: this.#deps.newId(),
        deviceId,
        tokenHash: hashToken(token),
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + REFRESH_TTL_MS).toISOString(),
        replacedBy: null,
        revokedAt: null,
      })
      .run();
    return token;
  }

  async #access(deviceId: string, now: Date): Promise<string> {
    const row = this.#deps.db
      .select({ userId: devices.userId, role: users.role })
      .from(devices)
      .innerJoin(users, eq(users.id, devices.userId))
      .where(eq(devices.id, deviceId))
      .get();
    if (!row) throw apiError('UNAUTHENTICATED');
    return signAccess({ sub: row.userId, did: deviceId, role: row.role }, this.#deps.keys, now);
  }
}
