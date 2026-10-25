import {
  AppErrorException,
  ERROR_CODES,
  orderedLocations,
  type Settings,
  type SystemDefinition,
} from '@nextlevel/shared';
import { join } from 'node:path';
import type { WalkJob } from './types.ts';

function jobFor(settings: Settings, system: SystemDefinition): WalkJob {
  const own = settings.systems[system.id];
  const folder = own?.folderName ?? system.defaultFolderName;
  return {
    systemId: system.id,
    dirs: orderedLocations(settings.storage.locations).map((location) => ({
      locationId: location.id,
      dir: join(location.path, folder),
    })),
    extensions: own?.extensions ?? system.extensions,
    ...(settings.storage.media.mode === 'central'
      ? { centralMediaDir: join(settings.storage.media.path, system.id) }
      : {}),
  };
}

/** Rejects explicit scan ids that are not in the catalog (`VALIDATION_FAILED`). */
export function assertKnownSystems(
  catalog: readonly SystemDefinition[],
  systemIds: readonly string[],
): void {
  const known = new Set(catalog.map((system) => system.id));
  const unknownSystemIds = systemIds.filter((id) => !known.has(id));
  if (unknownSystemIds.length > 0) {
    throw new AppErrorException({
      code: 'VALIDATION_FAILED',
      message: ERROR_CODES.VALIDATION_FAILED,
      details: { unknownSystemIds },
    });
  }
}

/**
 * Which systems a scan walks (owner decision 2026-10-21). Without ids: enabled systems plus
 * systems the user never touched whose folder exists in a storage location. With ids: exactly
 * those, switched off or not.
 */
export async function planScan(
  settings: Settings,
  catalog: readonly SystemDefinition[],
  systemIds: readonly string[] | undefined,
  folderExists: (dir: string) => Promise<boolean>,
): Promise<WalkJob[]> {
  if (systemIds) {
    assertKnownSystems(catalog, systemIds);
    const byId = new Map(catalog.map((system) => [system.id, system]));
    return systemIds.flatMap((id) => {
      const system = byId.get(id);
      return system ? [jobFor(settings, system)] : [];
    });
  }

  const jobs: WalkJob[] = [];
  for (const system of catalog) {
    const own = settings.systems[system.id];
    const job = jobFor(settings, system);
    if (own?.enabled) jobs.push(job);
    else if (own === undefined) {
      const found = await Promise.all(job.dirs.map(({ dir }) => folderExists(dir)));
      if (found.some(Boolean)) jobs.push(job);
    }
  }
  return jobs;
}
