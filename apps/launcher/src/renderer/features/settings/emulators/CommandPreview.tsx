import type { Emulator, EmulatorProfile } from '@nextlevel/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getBridge } from '../../../bridge.ts';
import { errorMessageKey, unwrap } from '../settingsApi.ts';

const PREVIEW_DELAY_MS = 250;

function useDebounced<T>(value: T, delay: number): T {
  const [current, setCurrent] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrent(value);
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);
  return current;
}

/** The resolved command for the draft profile (S9 live preview, FR-EMU-5), rendered by main. */
export function CommandPreview({
  emulator,
  profile,
  gameId,
  valid,
}: {
  emulator: Emulator;
  profile: EmulatorProfile;
  gameId: number | null;
  valid: boolean;
}) {
  const { t } = useTranslation();
  const input = useDebounced(
    JSON.stringify({ emulator, profile, ...(gameId === null ? {} : { gameId }) }),
    PREVIEW_DELAY_MS,
  );
  const preview = useQuery({
    queryKey: ['launch.preview', input],
    queryFn: async () =>
      unwrap(
        await getBridge().invoke(
          'launch.preview',
          JSON.parse(input) as { emulator: Emulator; profile: EmulatorProfile; gameId?: number },
        ),
      ),
    enabled: valid,
    retry: false,
  });

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] text-slate-400">{t('settings.emulators.editor.preview')}</p>
      {!valid ? (
        <p className="text-xs text-slate-500">{t('settings.emulators.editor.previewInvalid')}</p>
      ) : preview.error ? (
        <p className="text-xs text-red-300">{t(errorMessageKey(preview.error))}</p>
      ) : (
        <code className="block rounded-lg bg-black/40 px-3 py-2 text-xs break-all text-emerald-200">
          {preview.data?.commandLine ?? '…'}
        </code>
      )}
      {gameId === null && (
        <p className="text-[11px] text-slate-500">
          {t('settings.emulators.editor.previewExample')}
        </p>
      )}
    </div>
  );
}
