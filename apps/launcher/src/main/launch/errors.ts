import { AppErrorException, ERROR_CODES, type ErrorCode } from '@nextlevel/shared';

/** The Settings section (and item) that fixes a launch error (IA: errors link to their fix). */
export interface LaunchFix {
  section: 'emulators' | 'systems' | 'storage';
  id?: string;
}

export interface LaunchErrorDetails {
  fix?: LaunchFix;
  path?: string;
  stderrTail?: string;
  exitCode?: number;
}

export function launchError(code: ErrorCode, details: LaunchErrorDetails = {}): AppErrorException {
  return new AppErrorException({ code, message: ERROR_CODES[code], details });
}
