import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderPage, stubApi } from '../../test-utils.tsx';
import { HASH, SCOPES, file, item } from './catalogFixtures.ts';
import { ItemEditor } from './ItemEditor.tsx';

// FR-CAT-9, D65: catalog files kept at Google Drive or archive.org.

afterEach(() => {
  vi.unstubAllGlobals();
});

const ITEM = '/v1/admin/catalog/items/i1';
const SHARE = 'https://drive.google.com/file/d/starhopper01/view?usp=sharing';
const DIRECT =
  'https://drive.usercontent.google.com/download?id=starhopper01&export=download&confirm=t';

const linked = (state: 'checking' | 'failed' | null, extra: Record<string, unknown> = {}) =>
  file({
    id: 'l1',
    ...(state === null ? {} : { status: 'pending', size: 0, sha256: '' }),
    link: {
      host: 'drive',
      url: DIRECT,
      state,
      error: state === 'failed' ? 'linkNotFile' : null,
    },
    ...extra,
  });

describe('Files tab links (FR-CAT-9)', () => {
  it('FR-CAT-9: Add link sends name, role and link, and the file shows Checking link…', async () => {
    const u = userEvent.setup();
    let files: unknown[] = [];
    const calls = stubApi({
      [`GET ${ITEM}`]: () => ({ body: item({ files }) }),
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
      [`POST ${ITEM}/links`]: () => {
        files = [linked('checking')];
        return { body: linked('checking') };
      },
    });
    document.cookie = 'nl_csrf=tok';
    renderPage(<ItemEditor id="i1" tab="files" />);
    await u.type(await screen.findByLabelText('File name'), 'Star Hopper.nes');
    await u.type(screen.getByLabelText('Share link'), SHARE);
    await u.click(screen.getByRole('button', { name: 'Add link' }));
    await waitFor(() => {
      expect(calls.find((call) => call.url === `${ITEM}/links`)?.body).toEqual({
        filename: 'Star Hopper.nes',
        role: 'rom',
        link: SHARE,
      });
    });
    expect(await screen.findByText('Checking link…')).toBeVisible();
  });

  it('FR-CAT-9: a link the API would refuse shows the reason before sending', async () => {
    const u = userEvent.setup();
    const calls = stubApi({
      [`GET ${ITEM}`]: () => ({ body: item() }),
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
    });
    renderPage(<ItemEditor id="i1" tab="files" />);
    await u.type(await screen.findByLabelText('File name'), 'Star Hopper.nes');
    await u.type(screen.getByLabelText('Share link'), 'https://example.com/a.nes');
    await u.click(screen.getByRole('button', { name: 'Add link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only Google Drive and archive.org file links',
    );
    expect(calls.some((call) => call.url === `${ITEM}/links`)).toBe(false);
  });

  it('FR-CAT-9: a failed link shows its reason with Retry and Remove; a ready link shows its host and Check again', async () => {
    const u = userEvent.setup();
    const calls = stubApi({
      [`GET ${ITEM}`]: () => ({
        body: item({
          files: [
            linked('failed', { filename: 'Broken.nes' }),
            linked(null, { id: 'l2', filename: 'Star Hopper.nes', sha256: HASH }),
          ],
        }),
      }),
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
      [`POST ${ITEM}/files/l1/check`]: () => ({ body: linked('checking') }),
      [`POST ${ITEM}/files/l2/check`]: () => ({ body: linked('checking', { id: 'l2' }) }),
    });
    document.cookie = 'nl_csrf=tok';
    renderPage(<ItemEditor id="i1" tab="files" />);
    const broken = (await screen.findByText('Broken.nes')).closest('tr');
    if (!broken) throw new Error('no row');
    expect(broken).toHaveTextContent('Link failed: the host sent a web page, not the file');
    expect(within(broken).getByRole('button', { name: 'Remove Broken.nes' })).toBeVisible();
    await u.click(within(broken).getByRole('button', { name: 'Retry Broken.nes' }));
    const ready = screen.getByText('Star Hopper.nes').closest('tr');
    if (!ready) throw new Error('no row');
    expect(ready).toHaveTextContent('Google Drive');
    expect(within(ready).queryByLabelText('Replace Star Hopper.nes')).toBeNull();
    await u.click(within(ready).getByRole('button', { name: 'Check again Star Hopper.nes' }));
    await waitFor(() => {
      expect(calls.filter((call) => call.url.endsWith('/check')).map((c) => c.url)).toEqual([
        `${ITEM}/files/l1/check`,
        `${ITEM}/files/l2/check`,
      ]);
    });
  });

  it('FR-CAT-9: while any link is checking, the files list refreshes until it settles', async () => {
    let gets = 0;
    stubApi({
      [`GET ${ITEM}`]: () => {
        gets += 1;
        return { body: item({ files: [gets < 2 ? linked('checking') : linked(null)] }) };
      },
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
    });
    renderPage(<ItemEditor id="i1" tab="files" />);
    expect(await screen.findByText('Checking link…')).toBeVisible();
    expect(await screen.findByText('Google Drive', {}, { timeout: 5000 })).toBeVisible();
    expect(screen.queryByText('Checking link…')).toBeNull();
  }, 10_000);
});
