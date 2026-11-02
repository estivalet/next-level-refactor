import { win32 } from 'node:path';
import { launchError } from './errors.ts';

/** A pointer file holds one path; anything past this is not read. */
const POINTER_LIMIT = 4096;
/** A UTF-8 byte order mark at the start of the file (Notepad writes one). */
const BOM = new RegExp('^' + String.fromCharCode(0xfeff));

export interface PointerInput {
  romPath: string;
  /** The system folder on the ROM's storage location; pointer paths are relative to it. */
  systemDir: string;
  /** The profile's `pointerExtensions`, lowercase without dots. */
  extensions: readonly string[];
  exists(path: string): boolean;
  readText(path: string): Promise<string>;
}

/**
 * The file to launch for a ROM (FR-EMU-9). A ROM whose extension is a pointer extension (Xbox 360
 * `.m3u`, XBLA `.xbox360`) names the game in its first non-blank line, as a path inside the
 * system folder (`\content\<game>\…`, a leading slash is dropped); that file is returned. Other
 * ROMs are returned as they are, without being read.
 */
export async function followPointer(input: PointerInput): Promise<string> {
  const extension = win32.extname(input.romPath).slice(1).toLowerCase();
  if (!input.extensions.includes(extension)) return input.romPath;
  const text = (await input.readText(input.romPath)).slice(0, POINTER_LIMIT);
  const line = text
    .replace(BOM, '')
    .split(/\r?\n/)
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate !== '');
  if (!line) throw launchError('LAUNCH_FAILED', { reason: 'pointerEmpty', path: input.romPath });
  const target = win32.join(input.systemDir, line.replace(/^[\\/]+/, ''));
  if (!input.exists(target)) {
    throw launchError('LAUNCH_FAILED', { reason: 'pointerMissing', path: target });
  }
  return target;
}
