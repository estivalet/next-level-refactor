import type { DownloadGrant } from '@nextlevel/shared';
import { and, eq } from 'drizzle-orm';
import { createHmac, hkdfSync } from 'node:crypto';
import type { ApiContext } from '../context.ts';
import { catalogFiles, downloads } from '../db/schema.ts';
import { ApiError, apiError } from '../errors.ts';
import { signFileToken } from '../storage/tokens.ts';
import { visibleItem, type CatalogCaller } from './visible.ts';

// Download URLs (FR-CAT-6, security §2, §5): one 10-minute signed URL per file, each logged with
// the user, device and an HMAC of the address (never the address). 60 issues per hour per user.

export const FILE_URL_MS = 10 * 60 * 1000;
const LIMIT = 60;
const WINDOW_MS = 60 * 60 * 1000;

/** Issue times per user, per context (one API process, D29). */
const issued = new WeakMap<ApiContext, Map<string, number[]>>();

function takeIssue(ctx: ApiContext, userId: string): void {
  const now = ctx.clock().getTime();
  const byUser = issued.get(ctx) ?? new Map<string, number[]>();
  issued.set(ctx, byUser);
  const recent = (byUser.get(userId) ?? []).filter((at) => at > now - WINDOW_MS);
  if (recent.length >= LIMIT) {
    const retryAfterS = Math.max(1, Math.ceil(((recent[0] ?? now) + WINDOW_MS - now) / 1000));
    throw new ApiError('RATE_LIMITED', undefined, { retryAfter: retryAfterS });
  }
  recent.push(now);
  byUser.set(userId, recent);
}

const ipKeys = new WeakMap<Buffer, Buffer>();

/** HMAC-SHA256 of the address under a key derived from JWT_SECRET (security §5). */
export function ipHash(ctx: ApiContext, ip: string): string {
  const secret = ctx.env.jwtSecret;
  let key = ipKeys.get(secret);
  if (!key) {
    key = Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), 'nextlevel-ip', 32));
    ipKeys.set(secret, key);
  }
  return createHmac('sha256', key).update(ip).digest('hex');
}

export function issueDownloads(
  ctx: ApiContext,
  caller: CatalogCaller,
  itemId: string,
  deviceId: string,
  ip: string,
): DownloadGrant {
  if (deviceId !== caller.deviceId) throw apiError('FORBIDDEN');
  visibleItem(ctx, caller, itemId);
  takeIssue(ctx, caller.userId);
  const files = ctx.db
    .select()
    .from(catalogFiles)
    .where(and(eq(catalogFiles.itemId, itemId), eq(catalogFiles.status, 'ready')))
    .all();
  const at = ctx.clock().toISOString();
  const hash = ipHash(ctx, ip);
  const grant: DownloadGrant = { files: [] };
  ctx.db.transaction((tx) => {
    for (const file of files) {
      const { token, expiresAt } = signFileToken(ctx, {
        kind: 'file',
        id: file.id,
        userId: caller.userId,
        deviceId,
        ttlMs: FILE_URL_MS,
      });
      tx.insert(downloads)
        .values({
          id: ctx.newId(),
          userId: caller.userId,
          deviceId,
          fileId: file.id,
          itemId,
          issuedAt: at,
          ipHash: hash,
        })
        .run();
      grant.files.push({
        fileId: file.id,
        filename: file.filename,
        size: file.size,
        sha256: file.sha256,
        url: `${ctx.env.publicUrl}/v1/files/${token}`,
        expiresAt,
      });
    }
  });
  return grant;
}
