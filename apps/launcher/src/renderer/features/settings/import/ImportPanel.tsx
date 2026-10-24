import { AppErrorException, type ImportReport, type ImportSummary } from '@nextlevel/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../library/Modal.tsx';
import { pickFolder } from '../emulators/emulatorsApi.ts';
import { errorCode } from '../settingsApi.ts';
import { applyImport, dryRunImport, inspectImport, useImportProgress } from './importApi.ts';
import { ImportFolders } from './ImportFolders.tsx';
import { ImportReportView } from './ImportReportView.tsx';
import { ImportSummaryView } from './ImportSummaryView.tsx';

/** The import stopped because its scan was cancelled or failed (ImportService.scanImported). */
const scanIncomplete = (cause: unknown) =>
  cause instanceof AppErrorException &&
  (cause.error.details as { reason?: unknown } | undefined)?.reason === 'scanIncomplete';

type Phase = 'idle' | 'dryRunning' | 'confirming' | 'importing';

interface DryRun {
  folder: string;
  emulatorsFolder: string | null;
  report: ImportReport;
}

/**
 * Settings → Data → Import NextLevelOS (FR-IMP-2, US-B3, IA F6): choose the data folder and an
 * optional emulators folder (D14), dry run, read the report, then import (asked first) with
 * progress per stage and a summary. Import needs a dry run of exactly these folders.
 */
export function ImportPanel() {
  const { t, i18n } = useTranslation();
  const { progress, reset } = useImportProgress();
  const [folder, setFolder] = useState<string | null>(null);
  const [emulatorsFolder, setEmulatorsFolder] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState<DryRun | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const format = (n: number) => n.toLocaleString(i18n.language);
  const current =
    dryRun && dryRun.folder === folder && dryRun.emulatorsFolder === emulatorsFolder
      ? dryRun
      : null;

  const fail = (cause: unknown) => {
    if (errorCode(cause) === 'CONFLICT') {
      setDryRun(null);
      setError(t('settings.import.folderChanged'));
    } else if (scanIncomplete(cause)) {
      setError(t('settings.import.scanIncomplete'));
    } else {
      setError(t(cause instanceof AppErrorException ? cause.error.message : 'errors.internal'));
    }
  };

  const chooseFolder = async () => {
    const picked = await pickFolder(t('settings.import.chooseFolder'));
    if (!picked) return;
    setFolder(picked);
    setSummary(null);
    setError(null);
    setEmulatorsFolder((await inspectImport(picked)).emulatorsFolder);
  };

  const runDryRun = async () => {
    if (!folder) return;
    setPhase('dryRunning');
    setError(null);
    setSummary(null);
    reset();
    try {
      setDryRun({
        folder,
        emulatorsFolder,
        report: await dryRunImport({ folder, emulatorsFolder }),
      });
    } catch (cause) {
      fail(cause);
    } finally {
      setPhase('idle');
    }
  };

  const runImport = async () => {
    if (!current) return;
    setPhase('importing');
    setError(null);
    reset();
    try {
      setSummary(
        await applyImport({
          folder: current.folder,
          emulatorsFolder: current.emulatorsFolder,
          reportToken: current.report.token,
        }),
      );
      setDryRun(null);
    } catch (cause) {
      fail(cause);
    } finally {
      setPhase('idle');
    }
  };

  const busy = phase === 'dryRunning' || phase === 'importing';
  return (
    <section aria-labelledby="import-nextlevelos" className="flex flex-col gap-3">
      <h3 id="import-nextlevelos" className="text-sm font-semibold text-white">
        {t('settings.import.title')}
      </h3>
      <p className="text-xs text-slate-400">{t('settings.import.intro')}</p>
      <ImportFolders
        folder={folder}
        emulatorsFolder={emulatorsFolder}
        disabled={busy}
        onChooseFolder={() => void chooseFolder()}
        onEmulatorsFolder={setEmulatorsFolder}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!folder || busy}
          onClick={() => void runDryRun()}
          className={SECONDARY_BUTTON}
        >
          {t('settings.import.dryRun')}
        </button>
        <button
          type="button"
          disabled={!current || busy}
          onClick={() => {
            setPhase('confirming');
          }}
          className={PRIMARY_BUTTON}
        >
          {t('settings.import.import')}
        </button>
      </div>
      {busy && (
        <p role="status" className="text-xs text-slate-300">
          {progress
            ? t('settings.import.progress', {
                stage: t(`settings.import.stage.${progress.stage}`),
                done: format(progress.done),
                total: format(progress.total),
              })
            : t('settings.import.working')}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-[#ff8a80]">
          {error}
        </p>
      )}
      {summary && <ImportSummaryView summary={summary} />}
      {current && !busy && <ImportReportView report={current.report} />}
      {phase === 'confirming' && (
        <Modal
          title={t('settings.import.confirmTitle')}
          onClose={() => {
            setPhase('idle');
          }}
          footer={
            <>
              <button
                type="button"
                className={SECONDARY_BUTTON}
                onClick={() => {
                  setPhase('idle');
                }}
              >
                {t('settings.import.cancel')}
              </button>
              <button type="button" className={PRIMARY_BUTTON} onClick={() => void runImport()}>
                {t('settings.import.confirm')}
              </button>
            </>
          }
        >
          <p className="text-sm text-slate-200">{t('settings.import.confirmBody')}</p>
        </Modal>
      )}
    </section>
  );
}
