import { profilesFor, type Emulator, type EmulatorProfile, type Settings } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../settings/settingsApi.ts';

export type EmulatorGroup = { emulator: Emulator; profiles: EmulatorProfile[] };

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/**
 * The emulators set up to launch a system (FR-MUS-7): every profile listing it, grouped under its
 * emulator. Emulators are ordered by name, and each one's profiles by name.
 */
export function emulatorsFor(settings: Settings, systemId: string): EmulatorGroup[] {
  const groups = new Map<string, EmulatorGroup>();
  for (const profile of profilesFor(settings, systemId)) {
    const emulator = settings.emulators.find((candidate) => candidate.id === profile.emulatorId);
    if (!emulator) continue;
    const group = groups.get(emulator.id) ?? { emulator, profiles: [] };
    group.profiles.push(profile);
    groups.set(emulator.id, group);
  }
  return [...groups.values()]
    .sort((a, b) => byName(a.emulator, b.emulator))
    .map((group) => ({ ...group, profiles: [...group.profiles].sort(byName) }));
}

/**
 * Read-only list of a system's emulators and profiles, from the settings (FR-MUS-7). Shown the same
 * in read and edit mode: emulators are only edited in Settings → Emulators.
 */
export function EmulatorsSection({ title, systemId }: { title: string; systemId: string }) {
  const { t } = useTranslation();
  const settings = useSettings();
  const load = settings.data;
  const groups = load?.kind === 'ok' ? emulatorsFor(load.snapshot.settings, systemId) : null;
  return (
    <section className="mb-6" aria-label={title}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      {groups === null && (
        <p className="text-xs text-slate-500">
          {t(settings.isPending ? 'apps.museum.loading' : 'apps.museum.emulatorsError')}
        </p>
      )}
      {groups?.length === 0 && (
        <p className="text-xs text-slate-500">{t('apps.museum.emulatorsEmpty')}</p>
      )}
      {groups && groups.length > 0 && (
        <div className="flex flex-col gap-3">
          {groups.map(({ emulator, profiles }) => (
            <div key={emulator.id} className="text-sm">
              <h4 className="font-medium text-slate-200">
                {emulator.name}
                {emulator.version && (
                  <span className="ml-2 text-xs text-slate-500">{emulator.version}</span>
                )}
              </h4>
              <ul className="mt-1 flex flex-col gap-0.5 pl-3 text-xs text-slate-400">
                {profiles.map((profile) => (
                  <li key={profile.id}>{profile.name}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
