import { orderedLocations, type StorageLocation } from '@nextlevel/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v7 as uuidv7 } from 'uuid';
import { getBridge } from '../../bridge.ts';
import { useIpcEvent } from '../../events.ts';
import { SYSTEMS_KEY, useSystemSummaries } from '../library/libraryApi.ts';
import { usePickFolder, useSystemCatalog } from '../settings/settingsApi.ts';
import { NEXT_BUTTON, type StepProps } from './stepProps.ts';

const NAME_MAX = 40;
const folderName = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;
const samePath = (a: string, b: string) =>
  a.replace(/[\\/]+$/, '').toLowerCase() === b.replace(/[\\/]+$/, '').toLowerCase();

/** The folder's name, made unique among the locations ("ROMs", "ROMs (2)") and ≤ 40 chars. */
function uniqueName(path: string, locations: readonly StorageLocation[]): string {
  const taken = new Set(locations.map((location) => location.name.toLowerCase()));
  const base = folderName(path);
  for (let n = 1; ; n += 1) {
    const suffix = n === 1 ? '' : ` (${String(n)})`;
    const name = `${base.slice(0, NAME_MAX - suffix.length)}${suffix}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
}

/**
 * Step 2 (FR-ONB-1, US-B2): game folders in priority order (the first wins when a game is in
 * several), then Scan now with live progress and the games found per system. The Catalog games
 * folder (D45) is shown last and read-only: it is changed in Settings → Storage.
 */
export function FoldersStep({ settings, persist, next }: StepProps) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const pickFolder = usePickFolder();
  const [locations, setLocations] = useState<StorageLocation[]>(settings.storage.locations);
  const [scanning, setScanning] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const summaries = useSystemSummaries().data ?? [];
  const systems = useSystemCatalog().data ?? [];
  useIpcEvent('scan.progress', (progress) => {
    setScanning(progress.systemId ?? '');
  });
  useIpcEvent('scan.finished', () => {
    setScanning(null);
    setScanned(true);
    void client.invalidateQueries({ queryKey: SYSTEMS_KEY });
  });

  const own = locations.filter((location) => !location.managed);
  const managed = locations.filter((location) => location.managed);
  const withLocations = () => ({
    ...settings,
    storage: { ...settings.storage, locations: orderedLocations([...own, ...managed]) },
  });
  const add = (path: string) => {
    if (locations.some((location) => samePath(location.path, path))) {
      setProblem(t('setup.folders.duplicate'));
      return;
    }
    setProblem(null);
    setLocations([
      ...own,
      { id: uuidv7(), name: uniqueName(path, locations), path, priority: own.length + 1 },
      ...managed,
    ]);
  };
  const scan = async () => {
    setProblem(null);
    setScanning('');
    try {
      await persist(withLocations());
      const started = await getBridge().invoke('scan.start', {});
      if (!started.ok) throw new Error(started.error.code);
    } catch {
      setScanning(null);
      setProblem(t('setup.folders.scanFailed'));
    }
  };
  const found = summaries.filter((row) => row.games > 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-300">{t('setup.folders.intro')}</p>
      <ol aria-label={t('setup.folders.list')} className="flex flex-col gap-2">
        {[...own, ...managed].map((location, index) => (
          <li
            key={location.id}
            className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2 text-sm"
          >
            <span className="w-5 text-xs text-slate-400">{index + 1}</span>
            <span className="flex-1 truncate text-white">{location.path}</span>
            {location.managed ? (
              <span className="rounded bg-sky-500/20 px-2 py-0.5 text-xs text-sky-200">
                {t('settings.storage.managed')}
              </span>
            ) : (
              <button
                type="button"
                aria-label={t('setup.folders.remove', { path: location.path })}
                onClick={() => {
                  setLocations((list) => list.filter((l) => l.id !== location.id));
                }}
                className="rounded p-1 text-slate-300 hover:bg-white/10"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pickFolder.isPending}
          onClick={() => {
            pickFolder.mutate(t('setup.folders.pickTitle'), {
              onSuccess: (path) => {
                if (path) add(path);
              },
            });
          }}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
        >
          {t('setup.folders.add')}
        </button>
        <button
          type="button"
          disabled={own.length === 0 || scanning !== null}
          onClick={() => void scan()}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20 disabled:opacity-50"
        >
          {t('setup.folders.scan')}
        </button>
      </div>
      {problem && (
        <p role="alert" className="text-xs text-[#ff8a80]">
          {problem}
        </p>
      )}
      {scanning !== null && (
        <p role="status" className="text-xs text-slate-300">
          {t('setup.folders.scanning', {
            system: systems.find((s) => s.id === scanning)?.name ?? '…',
          })}
        </p>
      )}
      {scanned && (
        <ul aria-label={t('setup.folders.found')} className="text-sm text-slate-200">
          {found.length === 0 && <li className="text-slate-400">{t('setup.folders.none')}</li>}
          {found.map((row) => (
            <li key={row.id}>
              {t('setup.folders.count', {
                system: systems.find((s) => s.id === row.id)?.name ?? row.id,
                count: row.games,
              })}
            </li>
          ))}
        </ul>
      )}
      <div>
        <button
          type="button"
          className={NEXT_BUTTON}
          onClick={() => {
            persist(withLocations()).then(next, () => {
              setProblem(t('setup.saveFailed'));
            });
          }}
        >
          {t('setup.next')}
        </button>
      </div>
    </div>
  );
}
