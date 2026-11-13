import { compareVersions, isVersion, type Settings, type UpdateState } from '@nextlevel/shared';
import type { UpdaterEvent, UpdaterPort } from './updaterAdapter.ts';

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

const NETWORK_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENETUNREACH',
  'EHOSTUNREACH',
]);

type Channel = Settings['updates']['channel'];

/** The newest release of a channel on GitHub, for zip copies. */
export type LatestRelease = (channel: Channel) => Promise<{ version: string; url: string } | null>;

/** nsis: installed, updates itself. zip: notice only. dev: never checks. */
export type UpdateMode =
  { kind: 'nsis'; updater: UpdaterPort } | { kind: 'zip'; latest: LatestRelease } | { kind: 'dev' };

export interface UpdateServiceDeps {
  mode: UpdateMode;
  currentVersion: string;
  settings: () => Settings['updates'];
  emit: (event: 'update.changed', state: UpdateState) => void;
  clock: () => Date;
  log: { warn(context: object, message: string): void };
}

/** Which UpdateState error code an updater error is. */
function errorCode(error: unknown): 'network' | 'signature' | 'other' {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (code === 'ERR_UPDATER_INVALID_SIGNATURE') return 'signature';
  const message = error instanceof Error ? error.message : String(error);
  return NETWORK_CODES.has(code) || message.includes('net::ERR_') ? 'network' : 'other';
}

const unsupported = (
  reason: 'dev' | 'zip',
  release: { version: string; url: string } | null = null,
): UpdateState => ({
  kind: 'unsupported',
  reason,
  availableVersion: release?.version ?? null,
  releaseUrl: release?.url ?? null,
});

/**
 * Updates from GitHub Releases (NFR-UPD-1, D53): checks at start and every 6 hours when automatic
 * checks are on, or when asked; downloads in the background; the update installs when NextLevel
 * quits, or now with Restart to update. Errors are shown and the next check tries again.
 */
export class UpdateService {
  private current: UpdateState;
  private lastCheck: string | null = null;
  private version: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly deps: UpdateServiceDeps) {
    this.current =
      deps.mode.kind === 'nsis' ? { kind: 'idle', lastCheck: null } : unsupported(deps.mode.kind);
  }

  state(): UpdateState {
    return this.current;
  }

  start(): void {
    const { mode } = this.deps;
    if (mode.kind === 'nsis')
      mode.updater.subscribe((event) => {
        this.onEvent(event);
      });
    this.applySettings();
    if (this.deps.settings().auto) void this.check();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * The channel in effect: a pre-release build (1.0.0-beta.1) always follows beta, otherwise a
   * beta tester on the default setting would never get the next beta (D59: 1.0 starts as a beta).
   */
  private channel(): Channel {
    const { channel } = this.deps.settings();
    const prerelease =
      isVersion(this.deps.currentVersion) && this.deps.currentVersion.includes('-');
    return prerelease ? 'beta' : channel;
  }

  /** Follows Settings → About: the channel, and whether checks run on their own. */
  applySettings(): void {
    const { auto } = this.deps.settings();
    if (this.deps.mode.kind === 'nsis')
      this.deps.mode.updater.setPrerelease(this.channel() === 'beta');
    if (auto && !this.timer) {
      this.timer = setInterval(() => void this.check(), CHECK_EVERY_MS);
      // Node timers: an unref'd timer never keeps NextLevel running.
      this.timer.unref();
    } else if (!auto) {
      this.stop();
    }
  }

  async check(): Promise<UpdateState> {
    const { mode } = this.deps;
    if (mode.kind === 'dev') return this.current;
    if (mode.kind === 'zip') {
      this.set(unsupported('zip', await this.newerRelease(mode.latest)));
      return this.current;
    }
    // A check is running, or an update is on its way or waiting for the restart.
    if (['checking', 'downloading', 'ready'].includes(this.current.kind)) return this.current;
    await mode.updater.check();
    return this.current;
  }

  /** Restart to update: quits and installs now (only once an update is downloaded). */
  restart(): void {
    if (this.deps.mode.kind === 'nsis' && this.current.kind === 'ready') {
      this.deps.mode.updater.quitAndInstall();
    }
  }

  private async newerRelease(latest: LatestRelease) {
    try {
      const release = await latest(this.channel());
      if (!release || !isVersion(release.version)) return null;
      return compareVersions(release.version, this.deps.currentVersion) > 0 ? release : null;
    } catch (error) {
      this.deps.log.warn({ error }, 'could not look up the latest release');
      return null;
    }
  }

  private onEvent(event: UpdaterEvent): void {
    switch (event.type) {
      case 'checking':
        this.set({ kind: 'checking' });
        return;
      case 'none':
        this.lastCheck = this.deps.clock().toISOString();
        this.set({ kind: 'idle', lastCheck: this.lastCheck });
        return;
      case 'available':
        this.version = event.version;
        this.set({ kind: 'downloading', version: event.version, percent: 0 });
        return;
      case 'progress':
        this.set({
          kind: 'downloading',
          version: this.version ?? '',
          percent: Math.min(100, Math.max(0, Math.round(event.percent))),
        });
        return;
      case 'downloaded':
        this.set({ kind: 'ready', version: event.version });
        return;
      case 'error':
        this.deps.log.warn({ error: event.error }, 'update failed');
        // A failed later check doesn't hide an update that is already waiting.
        if (this.current.kind !== 'ready')
          this.set({ kind: 'error', code: errorCode(event.error) });
        return;
    }
  }

  private set(state: UpdateState): void {
    this.current = state;
    this.deps.emit('update.changed', state);
  }
}
