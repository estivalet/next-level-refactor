import { AppErrorException, ERROR_CODES } from '@nextlevel/shared';

export function notFound(details?: unknown): AppErrorException {
  return new AppErrorException({ code: 'NOT_FOUND', message: ERROR_CODES.NOT_FOUND, details });
}
