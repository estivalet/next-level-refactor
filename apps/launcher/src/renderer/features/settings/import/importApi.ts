import type { ImportProgress, IpcInput } from '@nextlevel/shared';
import { useState } from 'react';
import { getBridge } from '../../../bridge.ts';
import { useIpcEvent } from '../../../events.ts';
import { unwrap } from '../settingsApi.ts';

/** D14: the emulators folder main suggests for a NextLevelOS data folder. */
export async function inspectImport(folder: string) {
  return unwrap(await getBridge().invoke('import.inspect', { folder }));
}

/** FR-IMP-2: what the import would do; writes nothing. */
export async function dryRunImport(input: IpcInput<'import.dryRun'>) {
  return unwrap(await getBridge().invoke('import.dryRun', input));
}

/** FR-IMP-1: imports with the dry run's token. */
export async function applyImport(input: IpcInput<'import.apply'>) {
  return unwrap(await getBridge().invoke('import.apply', input));
}

/** The latest `import.progress` from main; `reset` clears it when a new step starts. */
export function useImportProgress() {
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  useIpcEvent('import.progress', setProgress);
  return {
    progress,
    reset: () => {
      setProgress(null);
    },
  };
}
