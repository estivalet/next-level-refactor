import type { UpdateState } from '@nextlevel/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateService, type UpdateMode } from './UpdateService.ts';
import type { UpdaterEvent, UpdaterPort } from './updaterAdapter.ts';

const SIX_HOURS = 6 * 60 * 60 * 1000;

function fakePort() {
  let listener: (event: UpdaterEvent) => void = () => undefined;
  const port = {
    setPrerelease: vi.fn(),
    check: vi.fn(() => Promise.resolve()),
    quitAndInstall: vi.fn(),
    subscribe: (l: (event: UpdaterEvent) => void) => {
      listener = l;
    },
  } satisfies UpdaterPort;
  return {
    port,
    fire: (event: UpdaterEvent) => {
      listener(event);
    },
  };
}

function setup(
  o: { auto?: boolean; channel?: 'stable' | 'beta'; mode?: UpdateMode; version?: string } = {},
) {
  const prefs: { channel: 'stable' | 'beta'; auto: boolean } = {
    channel: o.channel ?? 'stable',
    auto: o.auto ?? true,
  };
  const { port, fire } = fakePort();
  const emitted: UpdateState[] = [];
  const service = new UpdateService({
    mode: o.mode ?? { kind: 'nsis', updater: port },
    currentVersion: o.version ?? '0.10.0',
    settings: () => prefs,
    emit: (_event, state) => emitted.push(state),
    clock: () => new Date('2026-11-13T10:00:00.000Z'),
    log: { warn: vi.fn() },
  });
  return { service, port, fire, emitted, prefs };
}

const plainZip = { kind: 'unsupported', reason: 'zip', availableVersion: null, releaseUrl: null };

describe('UpdateService (NFR-UPD-1, D53)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('UpdateService: auto on → checks at start and every 6 hours', async () => {
    const { service, port } = setup();
    service.start();
    expect(port.check).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(SIX_HOURS);
    expect(port.check).toHaveBeenCalledTimes(2);
    service.stop();
  });

  it('UpdateService: auto off → checks only on update.check; beta → allowPrerelease true', async () => {
    const { service, port } = setup({ auto: false, channel: 'beta' });
    service.start();
    expect(port.setPrerelease).toHaveBeenCalledWith(true);
    await vi.advanceTimersByTimeAsync(SIX_HOURS * 2);
    expect(port.check).not.toHaveBeenCalled();
    await service.check();
    expect(port.check).toHaveBeenCalledTimes(1);
    service.stop();
  });

  it('a 1.0.0-beta.1 launcher with default settings takes pre-releases (D59: the first release is a beta)', async () => {
    const { service, port } = setup({ auto: false, version: '1.0.0-beta.1' });
    service.start();
    expect(port.setPrerelease).toHaveBeenLastCalledWith(true);
    const latest = vi.fn(() =>
      Promise.resolve({ version: '1.0.0-beta.2', url: 'https://example.test/b2' }),
    );
    const zip = setup({ auto: false, version: '1.0.0-beta.1', mode: { kind: 'zip', latest } });
    zip.service.start();
    await zip.service.check();
    expect(latest).toHaveBeenCalledWith('beta');
    service.stop();
    zip.service.stop();
  });

  it('a settings change applies the channel and starts or stops the timer', async () => {
    const { service, port, prefs } = setup({ auto: false });
    service.start();
    prefs.auto = true;
    prefs.channel = 'beta';
    service.applySettings();
    expect(port.setPrerelease).toHaveBeenLastCalledWith(true);
    await vi.advanceTimersByTimeAsync(SIX_HOURS);
    expect(port.check).toHaveBeenCalledTimes(1);
    prefs.auto = false;
    service.applySettings();
    await vi.advanceTimersByTimeAsync(SIX_HOURS);
    expect(port.check).toHaveBeenCalledTimes(1);
    service.stop();
  });

  it('follows the updater: checking → downloading → ready; up to date → idle with the time', () => {
    const { service, fire, emitted } = setup({ auto: false });
    service.start();
    expect(service.state()).toEqual({ kind: 'idle', lastCheck: null });
    fire({ type: 'checking' });
    fire({ type: 'none' });
    expect(service.state()).toEqual({ kind: 'idle', lastCheck: '2026-11-13T10:00:00.000Z' });
    fire({ type: 'checking' });
    fire({ type: 'available', version: '1.0.1' });
    fire({ type: 'progress', percent: 41.7 });
    expect(service.state()).toEqual({ kind: 'downloading', version: '1.0.1', percent: 42 });
    fire({ type: 'downloaded', version: '1.0.1' });
    expect(service.state()).toEqual({ kind: 'ready', version: '1.0.1' });
    expect(emitted.map((state) => state.kind)).toEqual([
      'checking',
      'idle',
      'checking',
      'downloading',
      'downloading',
      'ready',
    ]);
  });

  it('UpdateService: update-downloaded → ready; restart calls quitAndInstall(true, true)', () => {
    const { service, port, fire } = setup({ auto: false });
    service.start();
    service.restart();
    expect(port.quitAndInstall).not.toHaveBeenCalled();
    fire({ type: 'downloaded', version: '1.0.1' });
    service.restart();
    expect(port.quitAndInstall).toHaveBeenCalledTimes(1);
  });

  it('ready → no more checks (the update installs at quit)', async () => {
    const { service, port, fire } = setup();
    service.start();
    fire({ type: 'downloaded', version: '1.0.1' });
    await service.check();
    await vi.advanceTimersByTimeAsync(SIX_HOURS);
    expect(port.check).toHaveBeenCalledTimes(1);
    service.stop();
  });

  it('UpdateService: an error event → error network/signature, keeps running, next check retries', async () => {
    const { service, port, fire } = setup();
    service.start();
    fire({ type: 'error', error: Object.assign(new Error('getaddrinfo'), { code: 'ENOTFOUND' }) });
    expect(service.state()).toEqual({ kind: 'error', code: 'network' });
    fire({ type: 'error', error: new Error('net::ERR_INTERNET_DISCONNECTED') });
    expect(service.state()).toEqual({ kind: 'error', code: 'network' });
    fire({
      type: 'error',
      error: Object.assign(new Error('not signed'), { code: 'ERR_UPDATER_INVALID_SIGNATURE' }),
    });
    expect(service.state()).toEqual({ kind: 'error', code: 'signature' });
    fire({ type: 'error', error: new Error('disk full') });
    expect(service.state()).toEqual({ kind: 'error', code: 'other' });
    await vi.advanceTimersByTimeAsync(SIX_HOURS);
    expect(port.check).toHaveBeenCalledTimes(2);
    service.stop();
  });

  it('development builds never check', async () => {
    const { service } = setup({ mode: { kind: 'dev' } });
    service.start();
    expect(await service.check()).toEqual({
      kind: 'unsupported',
      reason: 'dev',
      availableVersion: null,
      releaseUrl: null,
    });
    service.stop();
  });

  it('a zip copy learns about a newer release for its notice, and not about an older one', async () => {
    const latest = vi.fn((channel: 'stable' | 'beta') =>
      Promise.resolve(
        channel === 'beta'
          ? { version: '1.1.0-beta.1', url: 'https://example.test/beta' }
          : { version: '0.9.0', url: 'https://example.test/old' },
      ),
    );
    const zip = setup({ auto: false, mode: { kind: 'zip', latest } });
    zip.service.start();
    expect(await zip.service.check()).toEqual(plainZip);
    zip.prefs.channel = 'beta';
    expect(await zip.service.check()).toEqual({
      kind: 'unsupported',
      reason: 'zip',
      availableVersion: '1.1.0-beta.1',
      releaseUrl: 'https://example.test/beta',
    });
    expect(zip.emitted.at(-1)?.kind).toBe('unsupported');
    zip.service.stop();
  });

  it('a zip copy that cannot reach GitHub keeps its plain notice', async () => {
    const latest = vi.fn(() => Promise.reject(new Error('offline')));
    const zip = setup({ mode: { kind: 'zip', latest } });
    zip.service.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(latest).toHaveBeenCalledTimes(1);
    expect(zip.service.state()).toEqual(plainZip);
    zip.service.stop();
  });
});
