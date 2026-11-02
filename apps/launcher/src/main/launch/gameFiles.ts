import {
  renderArgs,
  renderValue,
  type EmulatorProfile,
  type TokenContext,
} from '@nextlevel/shared';
import { win32 } from 'node:path';
import { launchError } from './errors.ts';

/** An args file is a short list of options; anything longer is not read. */
const ARGS_FILE_LIMIT = 4096;

export interface GameFilesInput {
  profile: Pick<EmulatorProfile, 'entries' | 'argsFile'>;
  /** Token values for the game; `entry` and `entryArgs` are ignored. */
  ctx: TokenContext;
  exists(path: string): boolean;
  list(dir: string): Promise<string[]>;
  readText(path: string): Promise<string>;
}

export interface GameFiles {
  /** The first matching entry rule's args, for `{entryArgs}`. */
  entryArgs: string[];
  /** Words of the args file, added before the game's own extra args. */
  fileArgs: string[];
}

/** `*` in a file name matches any run of characters, ignoring case. */
function namePattern(name: string): RegExp {
  const escaped = name.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

/** The file a rendered rule path names: itself, or the first `*` match in its folder. */
async function find(path: string, input: GameFilesInput): Promise<string | null> {
  const name = win32.basename(path);
  if (!name.includes('*')) return input.exists(path) ? path : null;
  const dir = win32.dirname(path);
  const pattern = namePattern(name);
  const names = await input.list(dir).catch(() => [] as string[]);
  const match = names
    .filter((candidate) => pattern.test(candidate))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))[0];
  return match === undefined ? null : win32.join(dir, match);
}

/**
 * Finds a game's files by name (FR-EMU-9): the first entry rule whose file exists gives the
 * `{entryArgs}`; the args file, when present, gives words for the front of the extra args.
 */
export async function resolveGameFiles(input: GameFilesInput): Promise<GameFiles> {
  const ctx: TokenContext = { ...input.ctx, entry: '', entryArgs: [] };
  let entryArgs: string[] = [];
  const { entries, argsFile } = input.profile;
  if (entries.length > 0) {
    const looked: string[] = [];
    for (const rule of entries) {
      const path = renderValue(rule.file, ctx);
      const found = await find(path, input);
      if (found) {
        entryArgs = renderArgs(rule.args, { ...ctx, entry: found });
        break;
      }
      looked.push(path);
    }
    if (looked.length === entries.length) {
      throw launchError('LAUNCH_FAILED', { reason: 'entryMissing', looked });
    }
  }
  let fileArgs: string[] = [];
  if (argsFile) {
    const path = renderValue(argsFile, ctx);
    if (input.exists(path)) {
      const text = (await input.readText(path)).slice(0, ARGS_FILE_LIMIT);
      fileArgs = text.split(/\s+/).filter(Boolean);
    }
  }
  return { entryArgs, fileArgs };
}
