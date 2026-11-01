import {
  AppErrorException,
  EMPTY_LAUNCH_OVERRIDE,
  type LaunchOverride,
  type Settings,
  type SystemDefinition,
} from '@nextlevel/shared';
import { win32 } from 'node:path';
import { buildCommand } from '../../src/main/launch/buildCommand.ts';
import { resolveProfile } from '../../src/main/launch/resolve.ts';
import { locateRom } from '../../src/main/launch/romLocation.ts';
import type { Built } from './compare.ts';

/** The library row of a game, read straight from library.db. */
export interface LibraryGame {
  locationId: string | null;
  override: LaunchOverride;
}

export interface NewBuilt extends Built {
  profileName: string | null;
  notes: string[];
  /** Where the rebuild found the game and its emulator; null when it got no profile. */
  paths: { rom: string; systemDir: string; emulatorDir: string } | null;
}

/** The archives `prepareRom` extracts (launch/archives.ts). */
const ARCHIVES = new Set(['.zip', '.7z']);

const failed = (error: string, notes: string[] = []): NewBuilt => ({
  exe: null,
  args: [],
  cwd: null,
  env: {},
  error,
  profileName: null,
  notes,
  paths: null,
});

const codeOf = (error: unknown) =>
  error instanceof AppErrorException ? error.error.code : String(error);

/**
 * What the rebuild's LaunchService would start for a game (resolve → locate → build), without
 * extracting archives or starting anything. A missing file still builds, at the path the
 * rebuild would look first, with a note.
 */
export function newCommand(input: {
  settings: Settings;
  system: SystemDefinition | undefined;
  systemId: string | null;
  relPath: string;
  game: LibraryGame | null;
  exists: (path: string) => boolean;
}): NewBuilt {
  const { settings, systemId, relPath } = input;
  if (!systemId) return failed('NO_SYSTEM');
  const notes: string[] = [];
  if (!input.game) notes.push('not in the library');
  const override = input.game?.override ?? EMPTY_LAUNCH_OVERRIDE;
  let resolved;
  try {
    resolved = resolveProfile(settings, systemId, override);
  } catch (error) {
    return failed(codeOf(error), notes);
  }
  const { profile, emulator } = resolved;
  const lookup = {
    settings,
    system: input.system,
    systemId,
    relPath,
    locationId: input.game?.locationId ?? null,
  };
  let location;
  try {
    location = locateRom(lookup, input.exists);
  } catch {
    notes.push('ROM file not found');
    location = locateRom(lookup, () => true);
  }
  if (profile.archives === 'extract' && ARCHIVES.has(win32.extname(relPath).toLowerCase())) {
    notes.push('the rebuild extracts the archive first; {rom} becomes the extracted file');
  }
  const paths = {
    rom: location.path,
    systemDir: location.systemDir,
    emulatorDir: win32.dirname(emulator.executable),
  };
  try {
    const command = buildCommand({
      emulator,
      profile,
      romPath: location.path,
      systemDir: location.systemDir,
      systemId,
      core: override.core || profile.core || '',
      extraArgs: override.extraArgs,
      baseEnv: {},
    });
    return {
      exe: command.executable,
      args: command.args,
      cwd: command.cwd,
      env: command.env,
      error: null,
      profileName: profile.name,
      notes,
      paths,
    };
  } catch (error) {
    return { ...failed(codeOf(error), notes), profileName: profile.name, paths };
  }
}
