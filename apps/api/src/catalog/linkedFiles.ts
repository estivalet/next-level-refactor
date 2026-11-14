import {
  isLinkHost,
  normalizeLink,
  type AddLink,
  type AdminCatalogFile,
  type LinkError,
} from '@nextlevel/shared';
import { and, eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { ReadableStreamDefaultReader } from 'node:stream/web';
import { audited } from '../admin/audit.ts';
import type { ApiContext } from '../context.ts';
import { catalogFiles } from '../db/schema.ts';
import { apiError } from '../errors.ts';
import {
  checkFilename,
  itemOrNotFound,
  markReady,
  toAdminFile,
  touch,
  type FileRow,
} from './files.ts';

// Linked catalog files (FR-CAT-9, D65, ADR-015): a Drive or archive.org link the API downloads
// once to record size and SHA-256 (nothing is kept). Checks run in the background, two at a time
// per API process; the console polls the file's `link.state`.

const MAX_CHECKS = 2;
const CHECK_TIMEOUT_MS = 30 * 60 * 1000;

type Verified = { ok: true; size: number; sha256: string } | { ok: false; error: LinkError };

interface Checks {
  running: number;
  waiting: Array<() => void>;
  active: Set<Promise<void>>;
}
const checksOf = new WeakMap<ApiContext, Checks>();

function checks(ctx: ApiContext): Checks {
  let found = checksOf.get(ctx);
  if (!found) {
    found = { running: 0, waiting: [], active: new Set() };
    checksOf.set(ctx, found);
  }
  return found;
}

/** Downloads the link through SHA-256, keeping nothing; any doubt is a failure. */
async function verify(ctx: ApiContext, url: string): Promise<Verified> {
  let response: Response;
  try {
    response = await ctx.linkFetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, error: 'linkNetwork' };
  }
  const fail = async (error: LinkError): Promise<Verified> => {
    await response.body?.cancel().catch(() => undefined);
    return { ok: false, error };
  };
  // After redirects: still Google or archive.org, over https.
  if (!isLinkHost(response.url || url)) return fail('linkHost');
  if (!response.ok) return fail('linkStatus');
  // Drive's virus-scan and quota pages are HTML with a 200.
  if ((response.headers.get('content-type') ?? '').toLowerCase().startsWith('text/')) {
    return fail('linkNotFile');
  }
  if (!response.body) return fail('linkNetwork');
  const hash = createHash('sha256');
  let size = 0;
  const reader = response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > ctx.limits.upload) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, error: 'tooLarge' };
      }
      hash.update(chunk.value);
    }
  } catch {
    return { ok: false, error: 'linkNetwork' };
  }
  return { ok: true, size, sha256: hash.digest('hex') };
}

function fileRow(ctx: ApiContext, fileId: string): FileRow | undefined {
  return ctx.db.select().from(catalogFiles).where(eq(catalogFiles.id, fileId)).get();
}

function setLink(ctx: ApiContext, fileId: string, patch: Partial<FileRow>): void {
  ctx.db.update(catalogFiles).set(patch).where(eq(catalogFiles.id, fileId)).run();
}

/** Applies a check's result; the file may have been removed meanwhile (then nothing happens). */
async function settle(ctx: ApiContext, actorId: string, fileId: string, url: string) {
  const result = await verify(ctx, url);
  const row = fileRow(ctx, fileId);
  if (row?.linkUrl !== url) return;
  if (!result.ok) {
    setLink(ctx, fileId, { linkState: 'failed', linkError: result.error });
    return;
  }
  const item = itemOrNotFound(ctx, row.itemId);
  if (row.status === 'pending') {
    const verified = { ...row, size: result.size, sha256: result.sha256 };
    setLink(ctx, fileId, {
      size: result.size,
      sha256: result.sha256,
      linkState: null,
      linkError: null,
    });
    await markReady(ctx, actorId, item, { ...verified, linkState: null, linkError: null });
    return;
  }
  if (row.sha256 === result.sha256 && row.size === result.size) {
    setLink(ctx, fileId, { linkState: null, linkError: null });
    return;
  }
  // Check again found another file at the host: a new version of the item (D42).
  const after = {
    ...row,
    size: result.size,
    sha256: result.sha256,
    linkState: null,
    linkError: null,
  };
  audited(
    ctx,
    actorId,
    [
      {
        action: 'item.file.recheck',
        targetType: 'item',
        targetId: row.itemId,
        before: toAdminFile(row),
        after: toAdminFile(after),
      },
    ],
    () => {
      setLink(ctx, fileId, {
        size: result.size,
        sha256: result.sha256,
        linkState: null,
        linkError: null,
      });
      touch(ctx, item);
    },
  );
}

/** Queues a check; at most MAX_CHECKS run at once. */
function startCheck(ctx: ApiContext, actorId: string, fileId: string, url: string): void {
  const queue = checks(ctx);
  const run = async () => {
    if (queue.running >= MAX_CHECKS) {
      await new Promise<void>((resolve) => queue.waiting.push(resolve));
    }
    queue.running += 1;
    try {
      await settle(ctx, actorId, fileId, url);
    } catch {
      // A file that can't become ready (e.g. CONFLICT lastFile) was dropped by markReady.
    } finally {
      queue.running -= 1;
      queue.waiting.shift()?.();
    }
  };
  const done = run();
  queue.active.add(done);
  void done.finally(() => queue.active.delete(done));
}

/** Resolves once no link check is running or waiting (tests). */
export async function linkChecksIdle(ctx: ApiContext): Promise<void> {
  const queue = checks(ctx);
  while (queue.active.size > 0) await Promise.all([...queue.active]);
}

/** Adds a file kept at Drive or archive.org; it becomes ready once its check passes. */
export function addLink(
  ctx: ApiContext,
  actorId: string,
  itemId: string,
  input: AddLink,
): AdminCatalogFile {
  const item = itemOrNotFound(ctx, itemId);
  checkFilename(item, input.filename, input.role);
  const link = normalizeLink(input.link);
  if (!link.ok) {
    throw apiError('VALIDATION_FAILED', 'Only Google Drive and archive.org file links.', {
      reason: link.reason,
    });
  }
  const row: FileRow = {
    id: ctx.newId(),
    itemId,
    filename: input.filename,
    size: 0,
    sha256: '',
    storageKey: '',
    role: input.role,
    status: 'pending',
    createdAt: ctx.clock().toISOString(),
    linkUrl: link.url,
    linkState: 'checking',
    linkError: null,
  };
  ctx.db.insert(catalogFiles).values(row).run();
  startCheck(ctx, actorId, row.id, link.url);
  return toAdminFile(row);
}

/** Retry (a failed link) or Check again (a ready one); CONFLICT `checking` while one runs. */
export function checkLinkAgain(
  ctx: ApiContext,
  actorId: string,
  itemId: string,
  fileId: string,
): AdminCatalogFile {
  itemOrNotFound(ctx, itemId);
  const row = fileRow(ctx, fileId);
  if (row?.itemId !== itemId || row.linkUrl === null) throw apiError('NOT_FOUND');
  if (row.linkState === 'checking') {
    throw apiError('CONFLICT', 'This link is being checked.', { reason: 'checking' });
  }
  const claimed = ctx.db
    .update(catalogFiles)
    .set({ linkState: 'checking', linkError: null })
    .where(and(eq(catalogFiles.id, fileId), eq(catalogFiles.linkUrl, row.linkUrl)))
    .run();
  if (claimed.changes === 0) throw apiError('NOT_FOUND');
  startCheck(ctx, actorId, fileId, row.linkUrl);
  return toAdminFile({ ...row, linkState: 'checking', linkError: null });
}
