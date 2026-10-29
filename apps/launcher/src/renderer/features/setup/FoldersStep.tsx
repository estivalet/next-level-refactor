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

const folderName = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;

/**
 * Step 2 (FR-ONB-1, US-B2): game folders in priority order (the first wins when a game is in
 * several), then Scan now with live progress and the games found per system.
 */
export function FoldersStep({ settings, persist, next }: StepProps) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const pickFolder = usePickFolder();
  const [locations, setLocations] = useState<StorageLocation[]>(settings.storage.locations);
  const [scanning, setScanning] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
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

  const withLocations = () => ({
    ...settings,
    storage: { ...settings.storage, locations: orderedLocations(locations) },
  });
  const scan = async () => {
    await persist(withLocations());
    setScanning('');
    await getBridge().invoke('scan.start', {});
  };
  const found = summaries.filter((row) => row.games > 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-300">{t('setup.folders.intro')}</p>
      <ol aria-label={t('setup.folders.list')} className="flex flex-col gap-2">
        {locations.map((location, index) => (
          <li
            key={location.id}
            className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2 text-sm"
          >
            <span className="w-5 text-xs text-slate-400">{index + 1}</span>
            <span className="flex-1 truncate text-white">{location.path}</span>
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
                if (!path) return;
                setLocations((list) => [
                  ...list,
                  { id: uuidv7(), name: folderName(path), path, priority: list.length + 1 },
                ]);
              },
            });
          }}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
        >
          {t('setup.folders.add')}
        </button>
        <button
          type="button"
          disabled={locations.length === 0 || scanning !== null}
          onClick={() => void scan()}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20 disabled:opacity-50"
        >
          {t('setup.folders.scan')}
        </button>
      </div>
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
            void persist(withLocations()).then(next);
          }}
        >
          {t('setup.next')}
        </button>
      </div>
    </div>
  );
}
