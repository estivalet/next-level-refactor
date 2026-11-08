import type { Emulator, EmulatorProfile } from '@nextlevel/shared';
import { ChevronDown, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../library/Modal.tsx';
import { ActionMenu, type MenuAction } from './ActionMenu.tsx';
import { byName, matchesSearch, profileLabel } from './emulatorSearch.ts';
import { VirtualRows } from './VirtualRows.tsx';

const ICON_BUTTON =
  'rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none';

/**
 * Right pane of Settings → Emulators (FR-EMU-2, FR-EMU-7): the selected emulator's program and
 * its profiles A–Z with a filter and one Add profile ▾ (from the preset, or blank).
 */
export function EmulatorDetail({
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
  const [query, setQuery] = useState('');
  const rows = profiles
    .map((profile) => ({ profile, name: profileLabel(profile.name, emulator.name) }))
    .sort(byName);
  const shown = rows.filter((row) => matchesSearch(row.profile.name, query));
  const addActions: MenuAction[] = [
    ...(hasPreset
      ? [{ key: 'preset', label: t('settings.emulators.addFromPreset'), run: onAddFromPreset }]
      : []),
    { key: 'blank', label: t('settings.emulators.newProfile'), run: onNewProfile },
  ];

  return (
    <section aria-label={emulator.name} className="flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="text-base font-semibold text-white">{emulator.name}</h3>
          <span className="truncate text-xs text-slate-400" title={emulator.executable}>
            {emulator.executable}
          </span>
        </div>
        <button type="button" className={SECONDARY_BUTTON} onClick={onChangeProgram}>
          {t('settings.emulators.changeProgram')}
        </button>
        <ActionMenu
          label={t('settings.emulators.more', { name: emulator.name })}
          menuLabel={t('settings.emulators.more', { name: emulator.name })}
          buttonClassName={`${ICON_BUTTON} p-1.5`}
          actions={[
            {
              key: 'delete',
              label: t('settings.emulators.delete', { name: emulator.name }),
              run: onDelete,
            },
          ]}
        >
          <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
        </ActionMenu>
      </div>
      <div className="flex items-center gap-2 border-t border-white/5 pt-3">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
          />
          <input
            type="search"
            value={query}
            aria-label={t('settings.emulators.searchProfiles')}
            placeholder={t('settings.emulators.searchProfilesCount', { count: profiles.length })}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            className={`${INPUT} pl-8`}
          />
        </div>
        <ActionMenu
          label={t('settings.emulators.addProfile')}
          menuLabel={t('settings.emulators.addProfile')}
          buttonClassName={`${PRIMARY_BUTTON} flex items-center gap-1`}
          actions={addActions}
        >
          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
          {t('settings.emulators.addProfile')}
          <ChevronDown aria-hidden="true" className="h-3 w-3" />
        </ActionMenu>
      </div>
      {profiles.length === 0 ? (
        <p className="text-xs text-slate-500">{t('settings.emulators.noProfiles')}</p>
      ) : shown.length === 0 ? (
        <p className="text-xs text-slate-500">{t('settings.emulators.noProfileMatch')}</p>
      ) : (
        <VirtualRows
          items={shown}
          label={t('settings.emulators.profiles', { name: emulator.name })}
          rowHeight={32}
          maxHeight={480}
          getKey={(row) => row.profile.id}
          renderRow={({ profile, name }) => (
            <div className="flex w-full min-w-0 items-center gap-2 rounded-md px-1 text-xs hover:bg-white/5">
              <button
                type="button"
                tabIndex={-1}
                className="min-w-0 flex-1 truncate text-left text-slate-200"
                onClick={() => {
                  onEditProfile(profile.id);
                }}
              >
                {name}
              </button>
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
      )}
    </section>
  );
}
