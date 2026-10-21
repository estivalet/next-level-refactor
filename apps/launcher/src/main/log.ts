import log from 'electron-log/main';
import { join } from 'node:path';

// Rotating file log in the app's logs folder (architecture §7); no PII beyond ids.
log.transports.file.maxSize = 5 * 1024 * 1024;

type Context = Record<string, unknown>;

/** Sends the file log to `<logsDir>/main.log`; call once, before anything logs. */
export function initLogger(logsDir: string): void {
  log.transports.file.resolvePathFn = () => join(logsDir, 'main.log');
  log.initialize();
}

/** The launcher's main-process logger: structured context first, then the message. */
export const logger = {
  info(context: Context, msg: string): void {
    log.info(msg, context);
  },
  warn(context: object, msg: string): void {
    log.warn(msg, context);
  },
  error(context: Context, msg: string): void {
    log.error(msg, context);
  },
};
