import {
  AppErrorException,
  ERROR_CODES,
  formatCommandLine,
  type AppError,
  type Emulator,
  type EmulatorProfile,
  type LaunchOverride,
  type LaunchPreview,
  type Settings,
  type SystemDefinition,
  type TestLaunchResult,
} from '@nextlevel/shared';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { EmitEvent } from '../ipc/events.ts';
import type { LaunchGame, LaunchRepository } from '../library/LaunchRepository.ts';
import { prepareRom, type Extractor, type PreparedRom } from './archives.ts';
import { buildCommand, type LaunchCommand } from './buildCommand.ts';
import { launchError } from './errors.ts';
import { resolveProfile } from './resolve.ts';
import { locateRom, sampleRom } from './romLocation.ts';
import type { RunningProcess, SpawnFn } from './spawnProcess.ts';

/** D5: an exit code other than 0 within this time is a failed launch, not a play. */
export const FAILURE_WINDOW_MS = 10_000;
const EXTRACT_ROOT = 'nextlevel-launch';

export interface LaunchServiceDeps {
  /** The current settings (a load failure means defaults). */
  settings: () => Settings;
  system: (id: string) => SystemDefinition | undefined;
  launches: LaunchRepository;
  spawn: SpawnFn;
  exists: (path: string) => boolean;
  clock: () => Date;
  emit: EmitEvent;
  /** The launcher window: out of the way while a game runs (owner decision D4). */
  window: { minimize(): void; restore(): void };
  extractor: Extractor;
  tempDir: string;
  baseEnv: NodeJS.ProcessEnv;
  log: { warn(context: object, msg: string): void; error(context: object, msg: string): void };
}

/** A profile from Settings, saved or not, with the game to try it on (FR-EMU-5). */
export interface LaunchDraft {
  emulator: Emulator;
  profile: EmulatorProfile;
  gameId?: number;
}

interface Target {
  game?: LaunchGame;
  systemId: string;
  romPath: string;
  systemDir: string;
  override: LaunchOverride;
}

const EMPTY_OVERRIDE: LaunchOverride = { profileId: null, core: null, extraArgs: [] };

function preview(command: LaunchCommand): LaunchPreview {
  const { executable, args, cwd } = command;
  return { executable, args, cwd, commandLine: formatCommandLine(executable, args) };
}

/** Adds the "Fix in Settings" target to a launch error that has none. */
function withFix(error: unknown, profile: EmulatorProfile | undefined): unknown {
  if (!(error instanceof AppErrorException) || !profile) return error;
  const details = (error.error.details ?? {}) as Record<string, unknown>;
  if (details['fix'] || error.error.code !== 'LAUNCH_FAILED') return error;
  return new AppErrorException({
    ...error.error,
    details: { ...details, fix: { section: 'emulators', id: profile.id } },
  });
}

const errorCode = (error: unknown) =>
  error instanceof AppErrorException ? error.error.code : 'INTERNAL';

/**
 * Resolves, renders, pre-flights and spawns launches (architecture §4.3, ADR-004). One process
 * at a time; Play reports its exit through `launch.finished`.
 */
export class LaunchService {
  private busy = false;
  private current: { gameId: number; launchId: number } | null = null;

  constructor(private readonly deps: LaunchServiceDeps) {}

  running(): { gameId: number; launchId: number } | null {
    return this.current;
  }

  /** The command a draft would run, without any checks (FR-EMU-5 live preview). */
  preview(draft: LaunchDraft): LaunchPreview {
    return preview(this.command(draft.emulator, draft.profile, this.target(draft, false)));
  }

  /** Runs a draft profile against a game and waits for it to exit (FR-EMU-5); no play counted. */
  async test(draft: LaunchDraft & { gameId: number }): Promise<TestLaunchResult> {
    this.claim();
    let prepared: PreparedRom | undefined;
    try {
      const target = this.target(draft, true);
      prepared = await this.prepare(draft.profile, target);
      const command = this.command(draft.emulator, draft.profile, {
        ...target,
        romPath: prepared.path,
      });
      const shown = preview(command);
      const failed = (error: unknown, durationMs = 0): TestLaunchResult => ({
        ...shown,
        exitCode: null,
        stderrTail: '',
        durationMs,
        error: (withFix(error, draft.profile) as AppErrorException).error,
      });
      try {
        this.checkExecutable(draft.emulator, draft.profile);
      } catch (error) {
        if (error instanceof AppErrorException) return failed(error);
        throw error;
      }
      const started = this.deps.clock();
      const logId = this.logStart(command, draft.profile, target.game, started, true);
      let process: RunningProcess;
      try {
        process = await this.deps.spawn(command);
      } catch (error) {
        this.logEnd(logId, null, errorCode(error), null);
        if (error instanceof AppErrorException) return failed(error);
        throw error;
      }
      const { exitCode } = await process.exited;
      const stderrTail = process.stderrTail();
      this.logEnd(logId, exitCode, null, stderrTail || null);
      return {
        ...shown,
        exitCode,
        stderrTail,
        durationMs: this.deps.clock().getTime() - started.getTime(),
      };
    } finally {
      await prepared?.cleanup();
      this.busy = false;
    }
  }

  /** Plays a game from the library (FR-EMU-6, US-C2); resolves once the emulator started. */
  async play(gameId: number): Promise<{ launchId: number }> {
    this.claim();
    let prepared: PreparedRom | undefined;
    let profile: EmulatorProfile | undefined;
    let logId: number | undefined;
    let minimized = false;
    try {
      const settings = this.deps.settings();
      const game = this.deps.launches.gameInfo(gameId);
      const override = this.deps.launches.getOverride(gameId);
      const resolved = resolveProfile(settings, game.systemId, override);
      profile = resolved.profile;
      this.checkExecutable(resolved.emulator, profile);
      const target = this.target({ ...resolved, gameId }, true);
      prepared = await this.prepare(profile, target);
      const command = this.command(resolved.emulator, profile, {
        ...target,
        romPath: prepared.path,
      });
      const started = this.deps.clock();
      logId = this.logStart(command, profile, game, started, false);
      this.deps.window.minimize();
      minimized = true;
      const process = await this.deps.spawn(command);
      const launchId = logId;
      this.current = { gameId, launchId };
      this.deps.emit('launch.started', { launchId, gameId });
      void this.watch(process, { gameId, launchId, profile, started, prepared });
      return { launchId };
    } catch (error) {
      if (logId !== undefined) this.logEnd(logId, null, errorCode(error), null);
      if (minimized) this.deps.window.restore();
      await prepared?.cleanup();
      this.busy = false;
      throw withFix(error, profile);
    }
  }

  /** Removes extraction folders of launches the launcher never saw end. */
  async cleanupStaleExtractions(): Promise<void> {
    await rm(join(this.deps.tempDir, EXTRACT_ROOT), {
      recursive: true,
      force: true,
      maxRetries: 5,
    });
  }

  private async watch(
    process: RunningProcess,
    run: {
      gameId: number;
      launchId: number;
      profile: EmulatorProfile;
      started: Date;
      prepared: PreparedRom;
    },
  ): Promise<void> {
    let exitCode: number | null = null;
    let durationMs = 0;
    let error: AppError | undefined;
    try {
      ({ exitCode } = await process.exited);
      const ended = this.deps.clock();
      durationMs = Math.max(0, ended.getTime() - run.started.getTime());
      const stderrTail = process.stderrTail();
      if (exitCode !== 0 && durationMs < FAILURE_WINDOW_MS) {
        error = {
          code: 'LAUNCH_FAILED',
          message: ERROR_CODES.LAUNCH_FAILED,
          details: {
            ...(exitCode === null ? {} : { exitCode }),
            stderrTail,
            fix: { section: 'emulators', id: run.profile.id },
          },
        };
      } else {
        this.deps.launches.recordPlay(run.gameId, durationMs / 1000, ended);
      }
      this.logEnd(run.launchId, exitCode, error ? error.code : null, stderrTail || null);
      await run.prepared.cleanup();
    } catch (failure) {
      this.deps.log.error({ error: failure, launchId: run.launchId }, 'launch bookkeeping failed');
    } finally {
      this.deps.window.restore();
      this.current = null;
      this.busy = false;
      this.deps.emit('launch.finished', {
        launchId: run.launchId,
        gameId: run.gameId,
        exitCode,
        durationMs,
        counted: error === undefined,
        ...(error ? { error } : {}),
      });
    }
  }

  private claim(): void {
    if (this.busy) throw launchError('ALREADY_RUNNING');
    this.busy = true;
  }

  private checkExecutable(emulator: Emulator, profile: EmulatorProfile): void {
    const fix = { section: 'emulators' as const, id: profile.id };
    if (!this.deps.exists(emulator.executable)) {
      throw launchError('EMULATOR_MISSING', { path: emulator.executable, fix });
    }
    // shell: false can't run scripts; they need hooks (FR-EMU-9, after 1.0).
    if (/\.(bat|cmd)$/i.test(emulator.executable)) {
      throw launchError('LAUNCH_FAILED', { path: emulator.executable, reason: 'script', fix });
    }
  }

  /** The ROM to launch: the game's file (checked when `check`), or an example for previews. */
  private target(draft: { profile: EmulatorProfile; gameId?: number }, check: boolean): Target {
    const settings = this.deps.settings();
    if (draft.gameId === undefined) {
      const systemId = draft.profile.systems[0] ?? 'unknown';
      const sample = sampleRom(settings, this.deps.system(systemId), systemId);
      return {
        systemId,
        romPath: sample.path,
        systemDir: sample.systemDir,
        override: EMPTY_OVERRIDE,
      };
    }
    const game = this.deps.launches.gameInfo(draft.gameId);
    const location = locateRom(
      { settings, system: this.deps.system(game.systemId), ...game },
      check ? this.deps.exists : () => true,
    );
    return {
      game,
      systemId: game.systemId,
      romPath: location.path,
      systemDir: location.systemDir,
      override: this.deps.launches.getOverride(draft.gameId),
    };
  }

  private prepare(profile: EmulatorProfile, target: Target): Promise<PreparedRom> {
    const settings = this.deps.settings();
    return prepareRom({
      romPath: target.romPath,
      mode: profile.archives,
      systemExtensions:
        settings.systems[target.systemId]?.extensions ??
        this.deps.system(target.systemId)?.extensions ??
        [],
      dest: join(this.deps.tempDir, EXTRACT_ROOT, randomUUID()),
      extractor: this.deps.extractor,
    });
  }

  private command(emulator: Emulator, profile: EmulatorProfile, target: Target): LaunchCommand {
    return buildCommand({
      emulator,
      profile,
      romPath: target.romPath,
      systemDir: target.systemDir,
      systemId: target.systemId,
      core: target.override.core || profile.core || '',
      extraArgs: target.override.extraArgs,
      baseEnv: this.deps.baseEnv,
    });
  }

  private logStart(
    command: LaunchCommand,
    profile: EmulatorProfile,
    game: LaunchGame | undefined,
    started: Date,
    test: boolean,
  ): number {
    return this.deps.launches.start({
      gameId: game?.gameId ?? null,
      gameTitle: game?.title ?? '',
      profileId: profile.id,
      profileName: profile.name,
      argv: [command.executable, ...command.args],
      cwd: command.cwd,
      test,
      startedAt: started.toISOString(),
    });
  }

  private logEnd(id: number, exitCode: number | null, code: string | null, stderr: string | null) {
    this.deps.launches.finish(id, {
      endedAt: this.deps.clock().toISOString(),
      exitCode,
      errorCode: code,
      stderrTail: stderr,
    });
  }
}
