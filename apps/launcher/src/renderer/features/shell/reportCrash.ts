import { getBridge } from '../../bridge.ts';

/** Sends a crash an error boundary caught to main's log (NFR-REL-2); never throws. */
export function reportCrash(where: 'theme' | 'window' | 'shell', id: string, error: Error): void {
  try {
    void getBridge()
      .invoke('app.reportError', {
        where,
        id: id.slice(0, 100),
        message: error.message.slice(0, 2000),
        ...(error.stack ? { stack: error.stack.slice(0, 20000) } : {}),
      })
      .catch(() => undefined);
  } catch {
    // No bridge (a crash before it was set up): the boundary still shows its screen.
  }
}
