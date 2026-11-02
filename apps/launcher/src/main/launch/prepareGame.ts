import {
  renderArgs,
  renderValue,
  type Emulator,
  type EmulatorProfile,
  type TokenContext,
} from '@nextlevel/shared';
import { dirname, join, win32 } from 'node:path';
import type { PreparedRom } from './archives.ts';
import { launchError } from './errors.ts';
import { resolveGameFiles } from './gameFiles.ts';
import type { MountedImage, Mounter } from './squashfs.ts';

/** What a launch knows about the game beyond its ROM path (FR-EMU-9). */
export interface GameValues {
  /** The folder holding the game's files: a mounted drive (`Q:`), a game folder, or romDir. */
  gameDir: string;
  entryArgs: string[];
  /** Words of the profile's args file, before the game's own extra args. */
  fileArgs: string[];
}

/** A ROM ready to launch: extracted and/or mounted, with its game files found. */
export interface PreparedGame extends PreparedRom, GameValues {}

export interface GameFileDeps {
  /** The squashfs mount tool for a launch with this emulator, or null if none was found. */
  mountTool: (emulator: Emulator) => string | null;
  mounterFor: (tool: string) => Mounter;
  /** `<data>\squashfs-overlay`: writes into mounted images land here, per system and image. */
  overlayRoot: string;
  exists: (path: string) => boolean;
  isDirectory: (path: string) => boolean;
  list: (dir: string) => Promise<string[]>;
  readText: (path: string) => Promise<string>;
}

const SQUASHFS = /\.wsquashfs$/i;
/** The drive shown in previews, where nothing is mounted. */
const PREVIEW_DRIVE = 'X:';

const mounts = (profile: EmulatorProfile, romPath: string) =>
  profile.squashfs === 'mount' && SQUASHFS.test(romPath);

/**
 * Mounts a `.wsquashfs` image when the profile says so and finds the game's files. The returned
 * `cleanup()` unmounts, then runs the ROM's own cleanup; a failure here cleans up at once.
 * `ctx` holds the game's token values with the prepared ROM as `{rom}`.
 */
export async function prepareGame(o: {
  rom: PreparedRom;
  emulator: Emulator;
  profile: EmulatorProfile;
  systemId: string;
  ctx: TokenContext;
  deps: GameFileDeps;
}): Promise<PreparedGame> {
  const { rom, profile, deps } = o;
  let mounted: MountedImage | undefined;
  const cleanup = async () => {
    await mounted?.unmount();
    await rom.cleanup();
  };
  try {
    let gameDir = deps.isDirectory(rom.path) ? rom.path : dirname(rom.path);
    if (mounts(profile, rom.path)) {
      const tool = deps.mountTool(o.emulator);
      if (!tool) {
        throw launchError('LAUNCH_FAILED', {
          reason: 'mountToolMissing',
          fix: { section: 'emulators', id: profile.id },
        });
      }
      const image = win32.basename(rom.path).replace(SQUASHFS, '');
      mounted = await deps
        .mounterFor(tool)
        .mount(rom.path, join(deps.overlayRoot, o.systemId, image));
      gameDir = mounted.root;
    }
    const files = await resolveGameFiles({
      profile,
      ctx: { ...o.ctx, gameDir },
      exists: deps.exists,
      list: deps.list,
      readText: deps.readText,
    });
    return { path: rom.path, gameDir, ...files, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

/** Game values for a preview (FR-EMU-5): no I/O, a placeholder drive, the first entry rule. */
export function previewGameValues(profile: EmulatorProfile, ctx: TokenContext): GameValues {
  const gameDir = mounts(profile, ctx.rom) ? PREVIEW_DRIVE : ctx.romDir;
  const rule = profile.entries[0];
  if (!rule) return { gameDir, entryArgs: [], fileArgs: [] };
  const withDir = { ...ctx, gameDir };
  try {
    const entry = renderValue(rule.file, withDir);
    return { gameDir, entryArgs: renderArgs(rule.args, { ...withDir, entry }), fileArgs: [] };
  } catch {
    return { gameDir, entryArgs: [], fileArgs: [] };
  }
}

/** Before the game's files are found; `{gameDir}` is set by the caller. */
export const NO_GAME_VALUES: GameValues = { gameDir: '', entryArgs: [], fileArgs: [] };
