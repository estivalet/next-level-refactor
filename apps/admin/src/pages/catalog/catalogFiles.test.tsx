import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderPage, stubApi, stubUploads } from '../../test-utils.tsx';
import { HASH, SCOPES, file, item, ready, refusal } from './catalogFixtures.ts';
import { ItemEditor } from './ItemEditor.tsx';

afterEach(() => {
  vi.unstubAllGlobals();
});

const ITEM = '/v1/admin/catalog/items/i1';

describe('Files tab (D41, FR-ADM-3)', () => {
  const fileOf = (name: string) => new File(['dummy bytes'], name, { type: '' });

  it('an upload shows progress, then size and SHA-256', async () => {
    const u = userEvent.setup();
    const uploads = stubUploads();
    const calls = stubApi({
      [`GET ${ITEM}`]: () => ({ body: item() }),
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
      [`POST ${ITEM}/files`]: () => ({
        body: { fileId: 'f1', uploadUrl: '/v1/admin/catalog/uploads/f1' },
      }),
      [`POST ${ITEM}/files/f1/complete`]: () => ({ body: file({ size: 8192 }) }),
    });
    document.cookie = 'nl_csrf=tok';
    renderPage(<ItemEditor id="i1" tab="files" />);
    await u.upload(await screen.findByLabelText('Upload a file'), fileOf('Star Hopper.nes'));
    await waitFor(() => {
      expect(uploads).toHaveLength(1);
    });
    expect(uploads[0]?.url).toBe('/v1/admin/catalog/uploads/f1');
    expect(uploads[0]?.headers['x-csrf-token']).toBe('tok');
    act(() => {
      uploads[0]?.progress(5, 10);
    });
    expect(screen.getByRole('progressbar', { name: 'Uploading Star Hopper.nes' })).toHaveAttribute(
      'value',
      '5',
    );
    expect(screen.getByText('50%')).toBeVisible();
    act(() => {
      uploads[0]?.respond(200, { size: 8192, sha256: HASH });
    });
    const done = await screen.findByRole('status');
    expect(done).toHaveTextContent('Star Hopper.nes uploaded: 8 KB');
    expect(done).toHaveTextContent(HASH);
    expect(calls.find((call) => call.url === `${ITEM}/files`)?.body).toEqual({
      filename: 'Star Hopper.nes',
      role: 'rom',
    });
  });

  it('switching tabs during an upload keeps its progress; leaving the page asks first', async () => {
    const u = userEvent.setup();
    const uploads = stubUploads();
    stubApi({
      [`GET ${ITEM}`]: () => ({ body: item() }),
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
      [`POST ${ITEM}/files`]: () => ({
        body: { fileId: 'f1', uploadUrl: '/v1/admin/catalog/uploads/f1' },
      }),
    });
    const page = renderPage(<ItemEditor id="i1" tab="files" />);
    await u.upload(await screen.findByLabelText('Upload a file'), fileOf('Star Hopper.nes'));
    await waitFor(() => {
      expect(uploads).toHaveLength(1);
    });
    act(() => {
      uploads[0]?.progress(3, 10);
    });
    page.rerender(<ItemEditor id="i1" tab="license" />);
    const leaving = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(leaving);
    expect(leaving.defaultPrevented).toBe(true);
    page.rerender(<ItemEditor id="i1" tab="files" />);
    expect(screen.getByRole('progressbar', { name: 'Uploading Star Hopper.nes' })).toHaveAttribute(
      'value',
      '3',
    );
  });

  it('a refused filename is explained before anything is sent', async () => {
    const u = userEvent.setup();
    const uploads = stubUploads();
    const calls = stubApi({
      [`GET ${ITEM}`]: () => ({ body: item() }),
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
    });
    renderPage(<ItemEditor id="i1" tab="files" />);
    await u.upload(await screen.findByLabelText('Upload a file'), fileOf('Star Hopper.exe'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '“Star Hopper.exe” can’t be used: a ROM or disc for Nintendo NES must end in .3dsen, .fds, .nes, .unf, .unif, .7z, or .zip.',
    );
    expect(uploads).toHaveLength(0);
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('a file over 4 GiB is refused before anything is sent', async () => {
    const u = userEvent.setup();
    const uploads = stubUploads();
    const calls = stubApi({
      [`GET ${ITEM}`]: () => ({ body: item() }),
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
    });
    renderPage(<ItemEditor id="i1" tab="files" />);
    const huge = fileOf('Star Hopper.nes');
    Object.defineProperty(huge, 'size', { value: 4 * 1024 ** 3 + 1 });
    await u.upload(await screen.findByLabelText('Upload a file'), huge);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '“Star Hopper.nes” is larger than 4 GiB, the most a catalog file can be.',
    );
    expect(uploads).toHaveLength(0);
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it("the server's filename refusal is explained too", async () => {
    const u = userEvent.setup();
    stubUploads();
    stubApi({
      [`GET ${ITEM}`]: () => ({ body: item() }),
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
      [`POST ${ITEM}/files`]: () => refusal('VALIDATION_FAILED', 'filename', 400),
    });
    renderPage(<ItemEditor id="i1" tab="files" />);
    await u.upload(await screen.findByLabelText('Upload a file'), fileOf('Star Hopper.nes'));
    expect(await screen.findByRole('alert')).toHaveTextContent('“Star Hopper.nes” can’t be used');
  });

  it('replace asks for confirmation on a published item', async () => {
    const u = userEvent.setup();
    const uploads = stubUploads();
    stubApi({
      [`GET ${ITEM}`]: () => ({ body: ready({ status: 'published' }) }),
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
      [`POST ${ITEM}/files`]: () => ({
        body: { fileId: 'f2', uploadUrl: '/v1/admin/catalog/uploads/f2' },
      }),
    });
    renderPage(<ItemEditor id="i1" tab="files" />);
    await u.upload(
      await screen.findByLabelText('Replace Star Hopper.nes'),
      fileOf('Star Hopper v2.nes'),
    );
    const dialog = screen.getByRole('dialog', { name: 'Replace Star Hopper.nes?' });
    expect(dialog).toHaveTextContent('players see Update available');
    expect(uploads).toHaveLength(0);
    await u.click(within(dialog).getByRole('button', { name: 'Replace' }));
    await waitFor(() => {
      expect(uploads).toHaveLength(1);
    });
  });

  it('a draft replaces without asking, under the same name', async () => {
    const u = userEvent.setup();
    const uploads = stubUploads();
    const calls = stubApi({
      [`GET ${ITEM}`]: () => ({ body: item({ files: [file()] }) }),
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
      [`POST ${ITEM}/files`]: () => ({
        body: { fileId: 'f2', uploadUrl: '/v1/admin/catalog/uploads/f2' },
      }),
    });
    renderPage(<ItemEditor id="i1" tab="files" />);
    await u.upload(await screen.findByLabelText('Replace Star Hopper.nes'), fileOf('other.nes'));
    await waitFor(() => {
      expect(uploads).toHaveLength(1);
    });
    expect(calls.find((call) => call.url === `${ITEM}/files`)?.body).toEqual({
      filename: 'Star Hopper.nes',
      role: 'rom',
    });
  });

  it('C10: a new upload named like an existing file keeps that file’s role', async () => {
    const u = userEvent.setup();
    const uploads = stubUploads();
    const calls = stubApi({
      [`GET ${ITEM}`]: () => ({ body: item({ files: [file()] }) }),
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
      [`POST ${ITEM}/files`]: () => ({
        body: { fileId: 'f2', uploadUrl: '/v1/admin/catalog/uploads/f2' },
      }),
    });
    renderPage(<ItemEditor id="i1" tab="files" />);
    await u.selectOptions(await screen.findByLabelText('Role'), 'extra');
    await u.upload(screen.getByLabelText('Upload a file'), fileOf('star hopper.NES'));
    await waitFor(() => {
      expect(uploads).toHaveLength(1);
    });
    expect(calls.find((call) => call.url === `${ITEM}/files`)?.body).toEqual({
      filename: 'star hopper.NES',
      role: 'rom',
    });
  });

  it("removing a published item's last game file is explained", async () => {
    const u = userEvent.setup();
    stubApi({
      [`GET ${ITEM}`]: () => ({ body: ready({ status: 'published' }) }),
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
      [`DELETE ${ITEM}/files/f1`]: () => refusal('CONFLICT', 'lastFile'),
    });
    renderPage(<ItemEditor id="i1" tab="files" />);
    await u.click(await screen.findByRole('button', { name: 'Remove Star Hopper.nes' }));
    await u.click(
      within(screen.getByRole('dialog', { name: 'Remove Star Hopper.nes?' })).getByRole('button', {
        name: 'Remove',
      }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A published item needs at least one ROM or disc file.',
    );
  });
});
