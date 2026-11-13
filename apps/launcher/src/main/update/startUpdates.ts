import { app } from 'electron';
import electronLog from 'electron-log/main';
import { NsisUpdater } from 'electron-updater';
import type { Settings } from '@nextlevel/shared';
import type { EmitEvent } from '../ipc/events.ts';
import { createLatestRelease } from './latestRelease.ts';
import { bindUpdater, createUpdaterAdapter, installKind } from './updaterAdapter.ts';
import { UpdateService, type UpdateMode } from './UpdateService.ts';

/**
 * Starts the updater (NFR-UPD-1, D53). Installed copies update themselves from GitHub Releases
 * with the download cache in `<data>\updates` (D50); zip copies only look up the newest release;
 * development builds never check.
 */
export function startUpdates(deps: {
  /** The NextLevel folder (where NextLevel.exe and its uninstaller are). */
  root: string;
  dataDir: string;
  settings: () => Settings['updates'];
  emit: EmitEvent;
  log: { warn(context: object, message: string): void };
}): UpdateService {
  const mode = updateMode(deps.root, deps.dataDir);
  const service = new UpdateService({
    mode,
    currentVersion: app.getVersion(),
    settings: deps.settings,
    emit: deps.emit,
    clock: () => new Date(),
    log: deps.log,
  });
  service.start();
  app.on('will-quit', () => {
    service.stop();
  });
  return service;
}

function updateMode(root: string, dataDir: string): UpdateMode {
  if (!app.isPackaged) return { kind: 'dev' };
  if (installKind(root) === 'zip')
    return { kind: 'zip', latest: createLatestRelease((url, init) => fetch(url, init)) };
  const updater = new NsisUpdater(undefined, createUpdaterAdapter(dataDir, app));
  updater.logger = electronLog;
  return { kind: 'nsis', updater: bindUpdater(updater) };
}
