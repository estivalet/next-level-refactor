import type { DetectedEmulator, EmulatorPreset } from '@nextlevel/shared';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';

/**
 * Folders below the chosen one that are searched (`<folder>/<a>/<b>/<c>/emu.exe`): three, so
 * Xenia Canary's `xenia\Emulators\Xenia Canary\xenia_canary.exe` is found (D6, amended 2026-11-02).
 */
const MAX_DEPTH = 3;

/** 0 when the program sits in a folder named like it (`xemu\xemu.exe`), else 1 (`xemu-c65\…`). */
function copyRank(executable: string): number {
  const stem = basename(executable, extname(executable)).toLowerCase();
  return basename(dirname(executable)).toLowerCase() === stem ? 0 : 1;
}

/**
 * Preset executables in a folder and its subfolders up to three levels deep (owner decision D6),
 * matched by file name ignoring case. Unreadable folders are skipped. When the folder exists,
 * Windows tools (`windowsTool` presets: cmd.exe for Script games) come from System32. Copies of
 * one program are listed with the one in a folder named like it first, since the first copy is
 * the one set up (variants like `xemu-chihiro` are other builds).
 */
export async function detectEmulators(
  folder: string,
  presets: readonly EmulatorPreset[],
  windowsDir = process.env['SystemRoot'] ?? 'C:\\Windows',
): Promise<DetectedEmulator[]> {
  const byName = new Map<string, string>();
  const found: DetectedEmulator[] = [];
  const tools = presets.filter((preset) => preset.windowsTool);
  for (const preset of presets) {
    if (preset.windowsTool) continue;
    for (const name of preset.executableNames) byName.set(name.toLowerCase(), preset.id);
  }
  if (existsSync(folder)) {
    for (const preset of tools) {
      for (const name of preset.executableNames) {
        const path = join(windowsDir, 'System32', name);
        if (existsSync(path)) found.push({ presetId: preset.id, executable: path });
      }
    }
  }
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
    (a, b) =>
      a.presetId.localeCompare(b.presetId) ||
      copyRank(a.executable) - copyRank(b.executable) ||
      a.executable.localeCompare(b.executable),
  );
}
