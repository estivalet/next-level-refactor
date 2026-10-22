import { useState } from 'react';

/** "Open this item" from outside Settings (US-C2: Fix in Settings); `n` makes each request new. */
export interface FocusRequest {
  id: string;
  n: number;
}

/**
 * Calls `open` when a new request arrives, during render (state derived from props), so the
 * section stays mounted and keeps its unsaved draft.
 */
export function useFocusRequest(request: FocusRequest | undefined, open: (id: string) => void) {
  const [seen, setSeen] = useState(request);
  if (request !== seen) {
    setSeen(request);
    if (request) open(request.id);
  }
}
