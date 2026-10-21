import type { Emulator, EmulatorProfile } from '@nextlevel/shared';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SECONDARY_BUTTON } from '../../library/Modal.tsx';
import { VirtualRows } from './VirtualRows.tsx';

const ICON_BUTTON =
  'rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none';

/** One emulator: its program, actions and profiles (FR-EMU-2). */
export function EmulatorCard({
  emulator,
  profiles,
  hasPreset,
  onChangeProgram,
  onAddFromPreset,
  onNewProfile,
  onEditProfile,
  onDeleteProfile,
  onDelete,
}: {
  emulator: Emulator;
  profiles: readonly EmulatorProfile[];
  hasPreset: boolean;
  onChangeProgram: () => void;
  onAddFromPreset: () => void;
  onNewProfile: () => void;
  onEditProfile: (id: string) => void;
  onDeleteProfile: (id: string) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <li className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold text-white">{emulator.name}</span>
          <span className="truncate text-xs text-slate-400">{emulator.executable}</span>
        </div>
        <button type="button" className={SECONDARY_BUTTON} onClick={onChangeProgram}>
          {t('settings.emulators.changeProgram')}
        </button>
        {hasPreset && (
          <button type="button" className={SECONDARY_BUTTON} onClick={onAddFromPreset}>
            {t('settings.emulators.addFromPreset')}
          </button>
        )}
        <button type="button" className={SECONDARY_BUTTON} onClick={onNewProfile}>
          {t('settings.emulators.newProfile')}
        </button>
        <button
          type="button"
          aria-label={t('settings.emulators.delete', { name: emulator.name })}
          className={ICON_BUTTON}
          onClick={onDelete}
        >
          <Trash2 aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      {profiles.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">{t('settings.emulators.noProfiles')}</p>
      ) : (
        <div className="mt-2 border-t border-white/5 pt-1">
          <VirtualRows
            items={profiles}
            label={t('settings.emulators.profiles', { name: emulator.name })}
            rowHeight={32}
            maxHeight={256}
            getKey={(profile) => profile.id}
            renderRow={(profile) => (
              <div className="flex w-full min-w-0 items-center gap-2 px-1 text-xs">
                <span className="min-w-0 flex-1 truncate text-slate-200">{profile.name}</span>
                <span className="shrink-0 text-slate-500">
                  {t('settings.emulators.systemCount', { count: profile.systems.length })}
                </span>
                <button
                  type="button"
                  aria-label={t('settings.emulators.editProfile', { name: profile.name })}
                  className={ICON_BUTTON}
                  onClick={() => {
                    onEditProfile(profile.id);
                  }}
                >
                  <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={t('settings.emulators.deleteProfile', { name: profile.name })}
                  className={ICON_BUTTON}
                  onClick={() => {
                    onDeleteProfile(profile.id);
                  }}
                >
                  <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          />
        </div>
      )}
    </li>
  );
}
