import type { IpcHandlers } from './ipc/router.ts';

/**
 * `app.reportError` (NFR-REL-2): a crash an error boundary caught in the renderer goes to the
 * rotating log (NFR-OBS-1). Not kiosk-guarded: it only writes a log line.
 */
export function createRendererErrorHandler(log: {
  error(context: Record<string, unknown>, message: string): void;
}): Pick<IpcHandlers, 'app.reportError'> {
  return {
    'app.reportError': ({ where, id, message, stack }) => {
      log.error(
        { where, id, ...(stack === undefined ? {} : { stack }) },
        `renderer crash: ${message}`,
      );
    },
  };
}
