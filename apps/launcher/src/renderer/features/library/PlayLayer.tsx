import { Gamepad2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LaunchErrorDetails, launchDetails } from '../launch/LaunchErrorDetails.tsx';
import { LocateEmulator } from '../setup/LocateEmulator.tsx';
import { useOpenApp } from '../shell/useOpenApp.ts';
import { useGameDetails } from './libraryApi.ts';
import { Modal, PRIMARY_BUTTON, SECONDARY_BUTTON } from './Modal.tsx';
import type { Play, PlayFailure } from './usePlay.ts';

/** "Playing <title>…" over the Library while a game runs (D4: the window is minimized then). */
function PlayingOverlay({ gameId }: { gameId: number }) {
  const { t } = useTranslation();
  const title = useGameDetails(gameId).data?.title;
  return (
    <div
      role="status"
      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/70"
    >
      <Gamepad2 aria-hidden="true" className="h-10 w-10 text-emerald-400" />
      <p className="text-sm font-semibold text-white">
        {title ? t('library.playing.title', { title }) : t('library.playing.untitled')}
      </p>
      <p className="text-xs text-slate-400">{t('library.playing.hint')}</p>
    </div>
  );
}

/** Why a Play failed, the emulator's output, and a link to the setting that fixes it (US-C2). */
function LaunchErrorDialog({
  failure,
  onClose,
  onRetry,
}: {
  failure: PlayFailure;
  onClose: () => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const openApp = useOpenApp();
  const title = useGameDetails(failure.gameId).data?.title;
  const { fix, exitCode, stderrTail } = launchDetails(failure.error);
  return (
    <Modal
      title={title ? t('library.launchError.title', { title }) : t('library.launchError.untitled')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
            {t('library.launchError.close')}
          </button>
          {fix && (
            <button
              type="button"
              className={PRIMARY_BUTTON}
              onClick={() => {
                openApp('settings', {
                  section: fix.section,
                  ...(fix.id ? { focusId: fix.id } : {}),
                });
                onClose();
              }}
            >
              {t('library.launchError.fix')}
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <LaunchErrorDetails error={failure.error} />
        {failure.error?.code === 'NO_PROFILE' && fix?.section === 'systems' && fix.id && (
          // US-B1: no emulator for the system — point at one, or get it from its site.
          <LocateEmulator
            systemId={fix.id}
            label={t('library.launchError.locate')}
            onLocated={() => {
              onClose();
              onRetry();
            }}
          />
        )}
        {exitCode !== undefined && (
          <p className="text-xs text-slate-300">
            {t('library.launchError.exitCode', { code: exitCode })}
          </p>
        )}
        {stderrTail && (
          <div className="flex flex-col gap-1">
            <p className="text-[11px] text-slate-400">{t('library.launchError.stderr')}</p>
            <pre className="max-h-48 overflow-auto rounded-lg bg-black/40 p-3 text-xs whitespace-pre-wrap text-slate-300">
              {stderrTail}
            </pre>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** What Play shows over the Library: the running game, then any failure. */
export function PlayLayer({ play }: { play: Play }) {
  return (
    <>
      {play.runningGameId !== null && <PlayingOverlay gameId={play.runningGameId} />}
      {play.failure && (
        <LaunchErrorDialog
          failure={play.failure}
          onClose={play.dismiss}
          onRetry={() => {
            if (play.failure) play.play(play.failure.gameId);
          }}
        />
      )}
    </>
  );
}
