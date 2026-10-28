import type { FastifyInstance } from 'fastify';
import { adminHeaders, adminSignIn } from './adminSignIn.ts';

type Session = Awaited<ReturnType<typeof adminSignIn>>;

export const LICENSE = {
  type: 'author-permission',
  rightsHolder: 'Pixel Pals',
  contact: 'pals@example.test',
  terms: 'May be distributed by NextLevel to subscribers.',
} as const;

/** The console's catalog calls, as an admin, for route tests (api-spec Admin catalog). */
export async function catalogAdmin(app: FastifyInstance) {
  const session: Session = await adminSignIn(app, 'admin');
  const send = (
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    url: string,
    payload?: object,
  ) =>
    app.inject({
      method,
      url,
      headers: adminHeaders(session, method !== 'GET'),
      ...(payload ? { payload } : {}),
    });
  const raw = (url: string, body: Buffer, contentType: string) =>
    app.inject({
      method: 'PUT',
      url,
      headers: { ...adminHeaders(session, true), 'content-type': contentType },
      payload: body,
    });
  const base = (id: string) => `/v1/admin/catalog/items/${id}`;

  const createItem = async (
    slug = 'star-hopper',
    extra: { systemId?: string; scopeSlug?: string } = {},
  ) => {
    await send('POST', '/v1/admin/scopes', {
      slug: extra.scopeSlug ?? 'homebrew-8bit',
      name: 'Homebrew 8-bit',
      description: '',
    });
    const created = await send('POST', '/v1/admin/catalog/items', {
      slug,
      // star-hopper → Star Hopper
      title: slug.replace(
        /(^|-)([a-z])/g,
        (_m, sep: string, c: string) => `${sep ? ' ' : ''}${c.toUpperCase()}`,
      ),
      systemId: extra.systemId ?? 'nintendo-nes',
      scopeSlug: extra.scopeSlug ?? 'homebrew-8bit',
    });
    return created.json<{ id: string }>().id;
  };

  const uploadFile = async (id: string, filename = 'Star Hopper.nes', role = 'rom') => {
    const started = await send('POST', `${base(id)}/files`, { filename, role });
    const { fileId, uploadUrl } = started.json<{ fileId: string; uploadUrl: string }>();
    await raw(uploadUrl, Buffer.from(`dummy bytes of ${filename}`), 'application/octet-stream');
    return send('POST', `${base(id)}/files/${fileId}/complete`, {});
  };

  const putLicense = (id: string, extra: Record<string, unknown> = {}) =>
    send('PUT', `${base(id)}/license`, { ...LICENSE, ...extra });

  const putEvidence = (
    id: string,
    body = Buffer.from('Signed permission email'),
    type = 'text/plain',
  ) => raw(`${base(id)}/license/evidence?filename=permission.txt`, body, type);

  /** Everything publishing needs: a verified license, on_lapse and a ROM. */
  const makePublishable = async (
    id: string,
    license: Record<string, unknown> = {},
    filename = 'Star Hopper.nes',
  ) => {
    await putLicense(id, license);
    await putEvidence(id);
    await send('POST', `${base(id)}/license/verify`);
    await send('PATCH', base(id), { onLapse: 'keep' });
    await uploadFile(id, filename);
  };

  return {
    session,
    send,
    raw,
    base,
    createItem,
    uploadFile,
    putLicense,
    putEvidence,
    makePublishable,
  };
}
