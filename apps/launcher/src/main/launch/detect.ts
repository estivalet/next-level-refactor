import type { DetectedEmulator, EmulatorPreset } from '@nextlevel/shared';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

/** Folders below the chosen one that are searched (`<folder>/<a>/<b>/emu.exe`). */
const MAX_DEPTH = 2;

/**
 * Preset executables in a folder and its subfolders up to two levels deep (owner decision D6),
 * matched by file name ignoring case. Unreadable folders are skipped.
 */
export async function detectEmulators(
  folder: string,
  presets: readonly EmulatorPreset[],
): Promise<DetectedEmulator[]> {
  const byName = new Map<string, string>();
  for (const preset of presets) {
    for (const name of preset.executableNames) byName.set(name.toLowerCase(), preset.id);
  }
  const found: DetectedEmulator[] = [];
  const visit = async (dir: string, depth: number): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory() && depth < MAX_DEPTH) await visit(path, depth + 1);
      const presetId = entry.isFile() ? byName.get(entry.name.toLowerCase()) : undefined;
      if (presetId) found.push({ presetId, executable: path });
    }
  };
  await visit(folder, 0);
  return found.sort(
    (a, b) => a.presetId.localeCompare(b.presetId) || a.executable.localeCompare(b.executable),
  );
}
