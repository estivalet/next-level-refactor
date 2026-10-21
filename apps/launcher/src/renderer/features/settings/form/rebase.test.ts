import { describe, expect, it } from 'vitest';
import { rebase } from './rebase.ts';

describe('rebase', () => {
  it('FR-SET-2: rebase keeps the user edits and takes the other changes', () => {
    const base = { systems: { a: { enabled: false } }, general: { language: 'en' } };
    const draft = {
      systems: { a: { enabled: false, folderName: 'Mine' } },
      general: { language: 'en' },
    };
    const next = {
      systems: { a: { enabled: false }, b: { enabled: true } },
      general: { language: 'pt-BR' },
    };
    expect(rebase(base, draft, next)).toEqual({
      systems: { a: { enabled: false, folderName: 'Mine' }, b: { enabled: true } },
      general: { language: 'pt-BR' },
    });
  });

  it('FR-SET-2: an unedited draft becomes the newer settings', () => {
    const base = { a: 1, list: [1, 2] };
    const next = { a: 2, list: [3] };
    expect(rebase(base, { a: 1, list: [1, 2] }, next)).toEqual(next);
  });

  it('FR-SET-2: an edited array or removed key in the draft wins as a whole', () => {
    const base = { list: [1, 2], gone: { x: 1 }, keep: 1 };
    const draft = { list: [2, 1], keep: 1 };
    const next = { list: [1, 2, 3], gone: { x: 1 }, keep: 2 };
    expect(rebase(base, draft, next)).toEqual({ list: [2, 1], keep: 2 });
  });

  it('FR-SET-2: a key removed elsewhere stays removed unless the user edited it', () => {
    expect(rebase({ a: { x: 1 }, b: 1 }, { a: { x: 1 }, b: 1 }, { b: 1 })).toEqual({ b: 1 });
    expect(rebase({ a: { x: 1 } }, { a: { x: 2 } }, {})).toEqual({ a: { x: 2 } });
  });

  it('FR-SET-2: key order does not count as an edit', () => {
    expect(rebase({ a: { x: 1, y: 2 } }, { a: { y: 2, x: 1 } }, { a: { x: 9, y: 2 } })).toEqual({
      a: { x: 9, y: 2 },
    });
  });
});
