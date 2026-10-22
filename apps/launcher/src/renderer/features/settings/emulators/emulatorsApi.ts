import { useQuery } from '@tanstack/react-query';
import { v7 as uuidv7 } from 'uuid';
import { getBridge } from '../../../bridge.ts';
import { unwrap } from '../settingsApi.ts';

/** The shipped emulator presets; they never change while the app runs (FR-EMU-7). */
export function usePresets() {
  return useQuery({
    queryKey: ['emulators.presets'],
    queryFn: async () => unwrap(await getBridge().invoke('emulators.presets')),
    staleTime: Infinity,
  });
}

/** Native file dialog for an emulator's program; null when cancelled. */
export async function pickExecutable(title: string): Promise<string | null> {
  return unwrap(await getBridge().invoke('app.pickFile', { kind: 'executable', title }));
}

export async function pickFolder(title: string): Promise<string | null> {
  return unwrap(await getBridge().invoke('app.pickFolder', { title }));
}

/** Preset programs in a folder, two levels deep (owner decision D6). */
export async function detectEmulators(folder: string) {
  return unwrap(await getBridge().invoke('emulators.detect', { folder }));
}

/** UUIDv7 ids for emulators and profiles (data model §1). */
export const newId = (): string => uuidv7();
