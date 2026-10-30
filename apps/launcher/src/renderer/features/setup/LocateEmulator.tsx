import { getSystem } from '@nextlevel/system-catalog';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { v7 as uuidv7 } from 'uuid';
import { getBridge } from '../../bridge.ts';
import { unwrap, useSaveSettings, useSettings } from '../settings/settingsApi.ts';
import { bestPreset, emulatorForSystem } from './emulatorForSystem.ts';

/**
 * Locate executable… and Official site for a system without an emulator (D48, US-B1): the
 * picked program plays the system afterwards (emulatorForSystem), or the player is told it can't.
 * No emulator is downloaded or installed.
 */
export function LocateEmulator({
  systemId,
  onLocated,
  label,
}: {
  systemId: string;
  onLocated?: () => void;
  /** The button's text; "Locate executable…" by default. */
  label?: string;
}) {
  const { t } = useTranslation();
  const settings = useSettings();
  const save = useSaveSettings();
  const preset = bestPreset(systemId);
  const locate = useMutation({
    mutationFn: async () => {
      const executable = unwrap(
        await getBridge().invoke('app.pickFile', {
          kind: 'executable',
          title: t('setup.emulators.pickTitle'),
        }),
      );
      const loaded = settings.data?.kind === 'ok' ? settings.data.snapshot : null;
      if (!executable || !loaded) return false;
      const result = emulatorForSystem(loaded.settings, systemId, executable, uuidv7);
      if ('refused' in result) throw new Error(result.refused);
      await save.mutateAsync({ settings: result.settings, baseRevision: loaded.revision });
      return true;
    },
    onSuccess: (located) => {
      if (located) onLocated?.();
    },
  });
  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={locate.isPending}
        onClick={() => {
          locate.mutate();
        }}
        className="rounded-lg bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-50"
      >
        {label ?? t('setup.emulators.locate')}
      </button>
      {preset?.homepage && (
        <a
          href={preset.homepage}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-sky-300 hover:underline"
        >
          {t('setup.emulators.officialSite')}
        </a>
      )}
      {locate.isError && (
        <span role="alert" className="text-xs text-[#ff8a80]">
          {locate.error.message === 'doesNotPlay'
            ? t('setup.emulators.doesNotPlay', { system: getSystem(systemId)?.name ?? systemId })
            : t('setup.emulators.locateFailed')}
        </span>
      )}
    </span>
  );
}
