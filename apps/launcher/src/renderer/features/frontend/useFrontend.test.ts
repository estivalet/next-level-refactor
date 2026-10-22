import { describe, expect, it } from 'vitest';
import { FRONTEND_CLOSED, frontendReducer } from './useFrontend.ts';

const draft = { title: 'Draft', nodes: [] };

describe('frontendReducer', () => {
  it('US-D5: a preview opens above, and leaving it keeps the front-end as it was', () => {
    const open = frontendReducer(FRONTEND_CLOSED, { type: 'show' });
    const previewing = frontendReducer(open, { type: 'show', previewDraft: draft });
    expect(previewing).toEqual({ mounted: true, visible: true, preview: draft });
    expect(frontendReducer(previewing, { type: 'hide' })).toEqual(open);
  });

  it('US-D5: a preview from the desktop never mounts the front-end', () => {
    const previewing = frontendReducer(FRONTEND_CLOSED, { type: 'show', previewDraft: draft });
    expect(previewing).toEqual({ mounted: false, visible: false, preview: draft });
    expect(frontendReducer(previewing, { type: 'hide' })).toEqual(FRONTEND_CLOSED);
  });
});
