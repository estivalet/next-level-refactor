import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '../errors.ts';
import en from '../i18n/en.json';
import ptBR from '../i18n/pt-BR.json';
import { ipcContract } from './contract.ts';
import { ipcEvents } from './events.ts';

const ITEM = {
  id: 'i1',
  slug: 'star-hopper',
  title: 'Star Hopper',
  systemId: 'nintendo-nes',
  scope: 'homebrew-8bit',
  year: 2024,
  genre: 'Shooter',
  size: 8192,
  license: { type: 'freeware', rightsHolder: 'Pixel Moth' },
  starter: false,
  version: 1,
  boxArt: null,
};

describe('catalog IPC contract (FR-CAT-3..7, US-E1..E3)', () => {
  it('catalog.list pages items with an install state; catalog.install/uninstall take an item id', () => {
    const list = ipcContract['catalog.list'];
    expect(list.input.safeParse({ system: 'nintendo-nes', q: 'star' }).success).toBe(true);
    expect(list.input.safeParse({ q: 'x'.repeat(101) }).success).toBe(false);
    expect(
      list.output.safeParse({ items: [{ ...ITEM, installState: 'update' }], nextCursor: null })
        .success,
    ).toBe(true);
    expect(
      list.output.safeParse({ items: [{ ...ITEM, installState: 'nope' }], nextCursor: null })
        .success,
    ).toBe(false);
    expect(ipcContract['catalog.install'].input.safeParse({ itemId: 'i1' }).success).toBe(true);
    expect(ipcContract['catalog.install'].input.safeParse({ itemId: '' }).success).toBe(false);
    const uninstall = ipcContract['catalog.uninstall'].input;
    expect(uninstall.parse({ itemId: 'i1' })).toEqual({ itemId: 'i1', confirm: false });
    expect(uninstall.safeParse({ itemId: 'i1', confirm: true, extra: 1 }).success).toBe(false);
  });

  it('downloads channels take a download id; events carry progress, results and removals', () => {
    for (const channel of ['downloads.pause', 'downloads.resume', 'downloads.cancel'] as const) {
      expect(ipcContract[channel].input.safeParse({ downloadId: 'd1' }).success).toBe(true);
      expect(ipcContract[channel].input.safeParse({}).success).toBe(false);
    }
    expect(
      ipcEvents['downloads.progress'].safeParse({
        downloadId: 'd1',
        itemId: 'i1',
        bytesDone: 10,
        bytesTotal: 20,
        state: 'downloading',
      }).success,
    ).toBe(true);
    expect(
      ipcEvents['downloads.finished'].safeParse({
        downloadId: 'd1',
        itemId: 'i1',
        result: 'failed',
        error: 'checksum',
      }).success,
    ).toBe(true);
    expect(ipcEvents['catalog.removed'].safeParse({ titles: ['Star Hopper'] }).success).toBe(true);
  });

  it('DOWNLOAD_FAILED has wording in both languages', () => {
    expect(ERROR_CODES.DOWNLOAD_FAILED).toBe('errors.downloadFailed');
    expect(en.errors.downloadFailed).toBeTruthy();
    expect(ptBR.errors.downloadFailed).toBeTruthy();
  });
});
