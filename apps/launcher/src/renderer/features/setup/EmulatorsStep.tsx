import { useTranslation } from 'react-i18next';
import { useSystemSummaries } from '../library/libraryApi.ts';
import { useSystemCatalog } from '../settings/settingsApi.ts';
import { LocateEmulator } from './LocateEmulator.tsx';
import { NEXT_BUTTON, type StepProps } from './stepProps.ts';

/**
 * Step 3 (FR-ONB-1, D48): each enabled system with games and whether an emulator plays it;
 * Locate executable… and Official site for the ones without. Nothing is installed for the player.
 */
export function EmulatorsStep({ settings, next }: StepProps) {
  const { t } = useTranslation();
  const systems = useSystemCatalog().data ?? [];
  const rows = (useSystemSummaries().data ?? []).filter((row) => row.enabled && row.games > 0);
  const covered = (systemId: string) =>
    settings.profiles.some((profile) => profile.systems.includes(systemId));
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-300">{t('setup.emulators.intro')}</p>
      {rows.length === 0 && <p className="text-sm text-slate-400">{t('setup.emulators.none')}</p>}
      <ul aria-label={t('setup.emulators.list')} className="flex flex-col gap-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2 text-sm"
          >
            <span className="flex-1 text-white">
              {systems.find((s) => s.id === row.id)?.name ?? row.id}
            </span>
            {covered(row.id) ? (
              <span className="text-xs text-emerald-300">{t('setup.emulators.ready')}</span>
            ) : (
              <LocateEmulator systemId={row.id} />
            )}
          </li>
        ))}
      </ul>
      <div>
        <button type="button" className={NEXT_BUTTON} onClick={next}>
          {t('setup.next')}
        </button>
      </div>
    </div>
  );
}
