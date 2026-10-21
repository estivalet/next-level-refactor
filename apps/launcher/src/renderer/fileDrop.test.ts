import { describe, expect, it } from 'vitest';
import { blockFileDrops } from './fileDrop.ts';

describe('blockFileDrops', () => {
  it.each(['dragover', 'drop'])(
    'NFR-SEC-1: %s on the document is cancelled so a dropped file never replaces the app',
    (type) => {
      const stop = blockFileDrops(document);
      const event = new Event(type, { cancelable: true, bubbles: true });
      document.body.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      stop();
    },
  );
});
