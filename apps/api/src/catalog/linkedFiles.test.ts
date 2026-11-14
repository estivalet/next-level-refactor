import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogAdmin } from '../../test/catalogAdmin.ts';
import { createTestApp, testEnv } from '../../test/testApp.ts';
import { createContext } from '../context.ts';
import { removeFile } from './files.ts';
import { addLink, checkLinkAgain, linkChecksIdle } from './linkedFiles.ts';

// FR-CAT-9, D65: a catalog file kept at Google Drive or archive.org, verified once by the API.

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

const DRIVE_SHARE = 'https://drive.google.com/file/d/starhopper01/view?usp=sharing';
const DRIVE_DIRECT =
  'https://drive.usercontent.google.com/download?id=starhopper01&export=download&confirm=t';
const BYTES = Buffer.from('NEXTLEVEL TEST FIXTURE star hopper\n'.repeat(20));
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

type Answer = () => Response;
const file =
  (bytes: Buffer, type = 'application/octet-stream'): Answer =>
  () =>
    new Response(bytes, { headers: { 'content-type': type } });

async function setup(opts: { upload?: number } = {}) {
  const test = await createTestApp();
  closers.push(test.close);
  const admin = await catalogAdmin(test.app);
  const answers = new Map<string, Answer>([[DRIVE_DIRECT, file(BYTES)]]);
  const linkFetch: typeof fetch = (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const answer = answers.get(url);
    return answer ? Promise.resolve(answer()) : Promise.reject(new TypeError('fetch failed'));
  };
  const ctx = createContext({
    env: testEnv({ FILES_DIR: test.filesDir }),
    db: test.db,
    clock: test.clock.read,
    billing: null,
    linkFetch,
    ...(opts.upload ? { limits: { upload: opts.upload } } : {}),
  });
  const actor = test.db.$client.prepare('select id from users limit 1').pluck().get() as string;
  const itemId = await admin.createItem();
  const files = () =>
    test.db.$client
      .prepare(
        `select filename, status, size, sha256, link_state as state, link_error as error
         from catalog_files order by created_at`,
      )
      .all() as Array<Record<string, unknown>>;
  const version = () =>
    test.db.$client.prepare('select version from catalog_items where id = ?').pluck().get(itemId);
  const add = async (filename = 'Star Hopper.nes', link = DRIVE_SHARE) => {
    const added = addLink(ctx, actor, itemId, { filename, role: 'rom', link });
    await linkChecksIdle(ctx);
    return added;
  };
  return { ...test, ...admin, ctx, actor, itemId, answers, files, version, add };
}

const audits = (t: Awaited<ReturnType<typeof setup>>, action: string) =>
  t.db.$client.prepare('select count(*) from audit_log where action = ?').pluck().get(action);

describe('linked catalog files in the API (FR-CAT-9, D65)', () => {
  it('FR-CAT-9: an added Drive link is checked, then ready with the size and checksum of the bytes', async () => {
    const t = await setup();
    const added = addLink(t.ctx, t.actor, t.itemId, {
      filename: 'Star Hopper.nes',
      role: 'rom',
      link: DRIVE_SHARE,
    });
    expect(added.link).toEqual({
      host: 'drive',
      url: DRIVE_DIRECT,
      state: 'checking',
      error: null,
    });
    await linkChecksIdle(t.ctx);
    expect(t.files()).toEqual([
      {
        filename: 'Star Hopper.nes',
        status: 'ready',
        size: BYTES.length,
        sha256: sha(BYTES),
        state: null,
        error: null,
      },
    ]);
    expect(audits(t, 'item.file.add')).toBe(1);
  });

  it('FR-CAT-9: a link the API would not accept is VALIDATION_FAILED with its reason', async () => {
    const t = await setup();
    expect(() =>
      addLink(t.ctx, t.actor, t.itemId, {
        filename: 'Star Hopper.nes',
        role: 'rom',
        link: 'https://example.com/a.nes',
      }),
    ).toThrow(
      expect.objectContaining({ code: 'VALIDATION_FAILED', details: { reason: 'linkHost' } }),
    );
    expect(t.files()).toEqual([]);
  });

  it('FR-CAT-9: a 200 HTML page is linkNotFile and nothing is recorded', async () => {
    const t = await setup();
    t.answers.set(
      DRIVE_DIRECT,
      file(Buffer.from('<html>quota</html>'), 'text/html; charset=utf-8'),
    );
    await t.add();
    expect(t.files()).toEqual([
      expect.objectContaining({
        status: 'pending',
        sha256: '',
        state: 'failed',
        error: 'linkNotFile',
      }),
    ]);
  });

  it('FR-CAT-9: a real text file (a readme sent as text/plain) is verified like any file', async () => {
    const t = await setup();
    const text = Buffer.from('NEXTLEVEL TEST FIXTURE readme\n');
    t.answers.set(DRIVE_DIRECT, file(text, 'text/plain; charset=utf-8'));
    addLink(t.ctx, t.actor, t.itemId, { filename: 'Readme.txt', role: 'extra', link: DRIVE_SHARE });
    await linkChecksIdle(t.ctx);
    expect(t.files()[0]).toMatchObject({ status: 'ready', sha256: sha(text), state: null });
  });

  it('FR-CAT-9: a Drive file that is not shared (sent to Google sign-in) is linkStatus, not linkHost', async () => {
    const t = await setup();
    t.answers.set(DRIVE_DIRECT, () => {
      const response = new Response('<html>sign in</html>', {
        headers: { 'content-type': 'text/html' },
      });
      Object.defineProperty(response, 'url', {
        value: 'https://accounts.google.com/ServiceLogin?continue=x',
      });
      return response;
    });
    await t.add();
    expect(t.files()[0]).toMatchObject({ status: 'pending', state: 'failed', error: 'linkStatus' });
  });

  it('FR-CAT-9: a redirect off Google/archive.org is linkHost', async () => {
    const t = await setup();
    t.answers.set(DRIVE_DIRECT, () => {
      const response = new Response(BYTES);
      Object.defineProperty(response, 'url', { value: 'https://evil.example/x' });
      return response;
    });
    await t.add();
    expect(t.files()[0]).toMatchObject({ status: 'pending', state: 'failed', error: 'linkHost' });
  });

  it('FR-CAT-9: a 404 is linkStatus; a dropped body is linkNetwork; more than the upload limit is tooLarge', async () => {
    const t = await setup({ upload: 100 });
    t.answers.set(DRIVE_DIRECT, () => new Response('gone', { status: 404 }));
    await t.add('A.nes');
    t.answers.set(DRIVE_DIRECT, () => {
      let sent = false;
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (sent) controller.error(new Error('dropped'));
          else controller.enqueue(new Uint8Array(BYTES.subarray(0, 10)));
          sent = true;
        },
      });
      return new Response(body);
    });
    await t.add('B.nes');
    t.answers.set(DRIVE_DIRECT, file(BYTES));
    await t.add('C.nes');
    expect(t.files().map((f) => f.error)).toEqual(['linkStatus', 'linkNetwork', 'tooLarge']);
  });

  it('FR-CAT-9: a ready link replaces a ready file of the same name; a failed one leaves it', async () => {
    const t = await setup();
    await t.uploadFile(t.itemId, 'Star Hopper.nes');
    t.answers.set(DRIVE_DIRECT, () => new Response('gone', { status: 404 }));
    await t.add();
    expect(t.files().map((f) => [f.status, f.sha256 === sha(BYTES)])).toEqual([
      ['ready', false],
      ['pending', false],
    ]);
    t.answers.set(DRIVE_DIRECT, file(BYTES));
    await t.add();
    const ready = t.files().filter((f) => f.status === 'ready');
    expect(ready).toEqual([expect.objectContaining({ sha256: sha(BYTES) })]);
  });

  it('FR-CAT-9: Check again with the same bytes changes nothing; with new bytes it updates size and checksum and bumps a published item version', async () => {
    const t = await setup();
    await t.makePublishable(t.itemId, {}, 'Other.nes');
    await t.send('POST', `${t.base(t.itemId)}/publish`);
    const fileId = (await t.add()).id;
    const before = t.version() as number;
    checkLinkAgain(t.ctx, t.actor, t.itemId, fileId);
    await linkChecksIdle(t.ctx);
    expect(t.version()).toBe(before);
    expect(audits(t, 'item.file.recheck')).toBe(0);
    const changed = Buffer.from('NEXTLEVEL TEST FIXTURE star hopper v2\n');
    t.answers.set(DRIVE_DIRECT, file(changed));
    checkLinkAgain(t.ctx, t.actor, t.itemId, fileId);
    await linkChecksIdle(t.ctx);
    expect(t.files().find((f) => f.filename === 'Star Hopper.nes')).toMatchObject({
      status: 'ready',
      size: changed.length,
      sha256: sha(changed),
      state: null,
    });
    expect(t.version()).toBe(before + 1);
    expect(audits(t, 'item.file.recheck')).toBe(1);
  });

  it('FR-CAT-9: a failed Check again keeps the ready file size, checksum and the item version', async () => {
    const t = await setup();
    await t.makePublishable(t.itemId, {}, 'Other.nes');
    await t.send('POST', `${t.base(t.itemId)}/publish`);
    const fileId = (await t.add()).id;
    const before = t.version();
    t.answers.set(DRIVE_DIRECT, () => new Response('gone', { status: 404 }));
    checkLinkAgain(t.ctx, t.actor, t.itemId, fileId);
    await linkChecksIdle(t.ctx);
    expect(t.files().find((f) => f.filename === 'Star Hopper.nes')).toMatchObject({
      status: 'ready',
      size: BYTES.length,
      sha256: sha(BYTES),
      state: 'failed',
      error: 'linkStatus',
    });
    expect(t.version()).toBe(before);
  });

  it('FR-CAT-9: Check again while a check runs is CONFLICT checking; an uploaded file is NOT_FOUND', async () => {
    const t = await setup();
    const added = addLink(t.ctx, t.actor, t.itemId, {
      filename: 'Star Hopper.nes',
      role: 'rom',
      link: DRIVE_SHARE,
    });
    expect(() => checkLinkAgain(t.ctx, t.actor, t.itemId, added.id)).toThrow(
      expect.objectContaining({ code: 'CONFLICT', details: { reason: 'checking' } }),
    );
    await linkChecksIdle(t.ctx);
    const uploaded = (await t.uploadFile(t.itemId, 'Other.nes')).json<{ id: string }>();
    expect(() => checkLinkAgain(t.ctx, t.actor, t.itemId, uploaded.id)).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    );
  });

  it('FR-CAT-9: removing a linked file deletes nothing from the store; a failed link can be removed', async () => {
    const t = await setup();
    const ready = await t.add();
    t.answers.set(DRIVE_DIRECT, () => new Response('gone', { status: 404 }));
    const failed = await t.add('Other.nes');
    const deleted = vi.spyOn(t.ctx.files, 'delete');
    await removeFile(t.ctx, t.actor, t.itemId, ready.id);
    await removeFile(t.ctx, t.actor, t.itemId, failed.id);
    expect(deleted).not.toHaveBeenCalled();
    expect(t.files()).toEqual([]);
  });
});
