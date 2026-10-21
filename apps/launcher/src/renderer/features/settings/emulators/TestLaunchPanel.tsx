import type { Emulator, EmulatorProfile } from '@nextlevel/shared';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getBridge } from '../../../bridge.ts';
import { LaunchErrorDetails, launchAppError } from '../../launch/LaunchErrorDetails.tsx';
import { PRIMARY_BUTTON } from '../../library/Modal.tsx';
import { unwrap } from '../settingsApi.ts';

/** Test launch (FR-EMU-5): runs the draft profile and shows command, exit code and stderr. */
export function TestLaunchPanel({
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
  const test = useMutation({
    mutationFn: async (input: { emulator: Emulator; profile: EmulatorProfile; gameId: number }) =>
      unwrap(await getBridge().invoke('launch.test', input)),
  });
  const result = test.data;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={PRIMARY_BUTTON}
          disabled={!valid || gameId === null || test.isPending}
          onClick={() => {
            if (gameId !== null) test.mutate({ emulator, profile, gameId });
          }}
        >
          {t('settings.emulators.editor.test')}
        </button>
        {gameId === null && (
          <span className="text-[11px] text-slate-500">
            {t('settings.emulators.editor.testNeedsGame')}
          </span>
        )}
        {test.isPending && (
          <span role="status" className="text-[11px] text-slate-300">
            {t('settings.emulators.editor.testing')}
          </span>
        )}
      </div>
      {test.error && <LaunchErrorDetails error={launchAppError(test.error)} />}
      {result && (
        <div role="status" className="flex flex-col gap-1 rounded-lg bg-black/40 p-3 text-xs">
          <code className="break-all text-emerald-200">{result.commandLine}</code>
          {result.error && <LaunchErrorDetails error={result.error} />}
          <p className="flex gap-2 text-slate-300">
            <span>
              {result.exitCode === null
                ? t('settings.emulators.editor.exitNone')
                : t('settings.emulators.editor.exitCode', { code: result.exitCode })}
            </span>
            <span>
              {t('settings.emulators.editor.duration', {
                seconds: (result.durationMs / 1000).toFixed(1),
              })}
            </span>
          </p>
          <p className="text-[11px] text-slate-400">{t('settings.emulators.editor.stderr')}</p>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-slate-300">
            {result.stderrTail || t('settings.emulators.editor.noStderr')}
          </pre>
        </div>
      )}
    </div>
  );
}
