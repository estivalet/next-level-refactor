import {
  AppErrorException,
  ERROR_CODES,
  type ErrorCode,
  type LaunchErrorDetails,
} from '@nextlevel/shared';

export function launchError(code: ErrorCode, details: LaunchErrorDetails = {}): AppErrorException {
  return new AppErrorException({ code, message: ERROR_CODES[code], details });
}
