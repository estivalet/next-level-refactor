import type { SystemPersonal } from '@nextlevel/shared';
import { useQuery } from '@tanstack/react-query';
import { getBridge } from '../../bridge.ts';
import { unwrap } from '../settings/settingsApi.ts';
import { MUSEUM_KEY, useMuseumMutation } from './museumApi.ts';

/**
 * The owner's notes and gallery for a system (FR-MUS-6, FR-MUS-8). Under `MUSEUM_KEY`, so it
 * reloads with the rest of the museum on `systems.infoChanged` and after every museum write.
 */
export function useSystemPersonal(systemId: string) {
  return useQuery({
    queryKey: [...MUSEUM_KEY, 'personal', systemId],
    queryFn: async () => unwrap(await getBridge().invoke('systems.personal.get', { systemId })),
  });
}

export function useSavePersonal() {
  return useMuseumMutation(async (input: { systemId: string; personal: SystemPersonal }) =>
    unwrap(await getBridge().invoke('systems.personal.save', input)),
  );
}

/** Opens main's image picker and copies the chosen images in (FR-MUS-8). */
export function useAddImages() {
  return useMuseumMutation(async (input: { systemId: string }) =>
    unwrap(await getBridge().invoke('systems.personal.addImages', input)),
  );
}

/**
 * Deletes images added during an edit that was then discarded (FR-MUS-6, FR-MUS-8). Main logs a
 * failure; there is nothing for the owner to do about it, so the result is ignored here.
 */
export async function cleanupImages(systemId: string): Promise<void> {
  await getBridge().invoke('systems.personal.cleanup', { systemId });
}
