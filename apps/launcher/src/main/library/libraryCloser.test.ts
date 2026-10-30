import { describe, expect, it } from 'vitest';
import { libraryCloser } from './libraryCloser.ts';

describe('closing the library at quit', () => {
  it('quit disposes downloads (and every other user) before closing the library', () => {
    const order: string[] = [];
    const closer = libraryCloser(() => {
      order.push('close db');
    });
    closer.beforeClose(() => {
      order.push('downloads.dispose');
    });
    closer.beforeClose(() => {
      throw new Error('a broken step');
    });
    closer.beforeClose(() => {
      order.push('catalog.dispose');
    });
    closer.close();
    closer.close();
    expect(order).toEqual(['downloads.dispose', 'catalog.dispose', 'close db']);
  });
});
