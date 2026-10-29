import { addEmulator, type EmulatorPreset } from '@nextlevel/shared';
import { getPresetProfile, getSystem, presetForExecutable } from '@nextlevel/system-catalog';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { v7 as uuidv7 } from 'uuid';
import { getBridge } from '../../bridge.ts';
import { unwrap, useSaveSettings, useSettings } from '../settings/settingsApi.ts';

/** The preset a system plays best with (its first preset profile), for its Official site. */
export function bestPreset(systemId: string): EmulatorPreset | undefined {
  const first = getSystem(systemId)?.presetProfiles[0];
  return first ? getPresetProfile(first)?.preset : undefined;
}

const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;

/**
 * Locate executable… and Official site for a system without an emulator (D48, US-B1): the
 * picked program becomes an emulator from its preset (by file name, else the system's best
 * preset) with the profiles for the enabled systems. No emulator is downloaded or installed.
 */
export function LocateEmulator({
  systemId,
  onLocated,
}: {
  systemId: string;
  onLocated?: () => void;
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
      const next = addEmulator(loaded.settings, {
        preset: presetForExecutable(fileName(executable)) ?? preset,
        executable,
        newId: uuidv7,
      });
      await save.mutateAsync({ settings: next, baseRevision: loaded.revision });
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
        {t('setup.emulators.locate')}
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
          {t('setup.emulators.locateFailed')}
        </span>
      )}
    </span>
  );
}
