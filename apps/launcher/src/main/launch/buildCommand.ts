import {
  renderArgs,
  renderValue,
  usesToken,
  type Emulator,
  type EmulatorProfile,
  type TokenContext,
} from '@nextlevel/shared';
import { win32 } from 'node:path';
import { launchError } from './errors.ts';

export interface CommandInput {
  emulator: Emulator;
  profile: EmulatorProfile;
  romPath: string;
  systemDir: string;
  systemId: string;
  /** Game override core, else the profile's, else ''. */
  core: string;
  extraArgs: readonly string[];
  baseEnv: NodeJS.ProcessEnv;
}

/** What `spawn` receives; never joined into a command string (ADR-004). */
export interface LaunchCommand {
  executable: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
}

/** Variables that would make an Electron- or Node-based emulator misbehave. */
const DROPPED_ENV = new Set(['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS']);

export function tokenContext(input: CommandInput): TokenContext {
  const romFile = win32.basename(input.romPath);
  const romExt = win32.extname(romFile);
  return {
    rom: input.romPath,
    romDir: win32.dirname(input.romPath),
    romName: romExt ? romFile.slice(0, -romExt.length) : romFile,
    romFile,
    romExt: romExt.replace(/^\./, ''),
    systemId: input.systemId,
    systemDir: input.systemDir,
    emulatorDir: win32.dirname(input.emulator.executable),
    core: input.core,
    extraArgs: input.extraArgs,
  };
}

/** Renders a profile for one ROM (architecture §4.3 steps 2–3). */
export function buildCommand(input: CommandInput): LaunchCommand {
  const { profile } = input;
  const cwdTemplate = profile.cwd ?? '{emulatorDir}';
  const templates = [...profile.args, cwdTemplate, ...Object.values(profile.env)];
  if (!input.core && templates.some((template) => usesToken(template, 'core'))) {
    throw launchError('CORE_MISSING', { fix: { section: 'emulators', id: profile.id } });
  }
  const ctx = tokenContext(input);
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.baseEnv)) {
    if (value !== undefined && !DROPPED_ENV.has(key.toUpperCase())) env[key] = value;
  }
  for (const [key, value] of Object.entries(profile.env)) env[key] = renderValue(value, ctx);
  return {
    executable: input.emulator.executable,
    args: renderArgs(profile.args, ctx),
    cwd: renderValue(cwdTemplate, ctx),
    env,
  };
}
