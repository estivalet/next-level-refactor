import { spawn } from 'node:child_process';
import type { LaunchCommand } from './buildCommand.ts';
import { launchError } from './errors.ts';

/** Bytes of stderr kept for the launch log and error dialog (FR-EMU-10). */
export const STDERR_TAIL_BYTES = 4096;

export interface RunningProcess {
  /** Resolves when the process has exited and its stderr is closed. */
  exited: Promise<{ exitCode: number | null }>;
  /** The last STDERR_TAIL_BYTES of stderr, decoded as UTF-8. */
  stderrTail(): string;
}

export type SpawnFn = (command: LaunchCommand) => Promise<RunningProcess>;

/**
 * Starts a program with an argv array and no shell (ADR-004, NFR-SEC-1). Resolves once the
 * process exists; rejects with LAUNCH_FAILED when it can't start (missing, not executable).
 */
export const spawnProcess: SpawnFn = (command) =>
  new Promise((resolve, reject) => {
    const child = spawn(command.executable, command.args, {
      cwd: command.cwd,
      env: command.env,
      shell: false,
      windowsHide: false,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let tail = Buffer.alloc(0);
    child.stderr.on('data', (chunk: Buffer) => {
      tail = Buffer.concat([tail, chunk]);
      if (tail.length > STDERR_TAIL_BYTES) tail = tail.subarray(tail.length - STDERR_TAIL_BYTES);
    });
    const exited = new Promise<{ exitCode: number | null }>((done) => {
      child.on('close', (code) => {
        done({ exitCode: code });
      });
    });
    child.once('spawn', () => {
      resolve({ exited, stderrTail: () => tail.toString('utf8') });
    });
    child.once('error', (error: NodeJS.ErrnoException) => {
      // Only reached before 'spawn' in practice; after it the promise is already settled.
      reject(
        launchError('LAUNCH_FAILED', {
          path: command.executable,
          reason: error.code ?? error.message,
        }),
      );
    });
  });
