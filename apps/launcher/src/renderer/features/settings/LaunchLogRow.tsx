import { ERROR_CODES, formatCommandLine, type LaunchLogEntry } from '@nextlevel/shared';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** m:ss, or h:mm:ss from an hour on. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const [h, m, s] = [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60];
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${String(h)}:${String(m).padStart(2, '0')}:${ss}` : `${String(m)}:${ss}`;
}

function Outcome({ entry }: { entry: LaunchLogEntry }) {
  const { t } = useTranslation();
  if (entry.errorCode) {
    const known = entry.errorCode in ERROR_CODES;
    return (
      <span
        className="text-red-300"
        title={known ? t(ERROR_CODES[entry.errorCode as keyof typeof ERROR_CODES]) : undefined}
      >
        {t('settings.data.launchLog.failed')}
      </span>
    );
  }
  if (entry.exitCode === null) return <span className="text-slate-500">—</span>;
  return <span>{t('settings.data.launchLog.exitCode', { code: entry.exitCode })}</span>;
}

/** One launch (FR-EMU-10): a summary line that expands to the command, folder and stderr. */
export function LaunchLogRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: LaunchLogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [executable = '', ...args] = entry.argv;
  const Chevron = expanded ? ChevronDown : ChevronRight;
  return (
    <div className="border-b border-white/5 text-xs">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="grid w-full grid-cols-[1rem_9rem_1fr_10rem_4rem_6rem] items-center gap-2 px-2 py-2 text-left text-slate-300 hover:bg-white/5"
      >
        <Chevron aria-hidden="true" className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-slate-500">
          {new Date(entry.startedAt).toLocaleString(i18n.language)}
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-white">{entry.gameTitle}</span>
          {entry.test && (
            <span className="rounded bg-sky-500/20 px-1.5 text-[10px] text-sky-200">
              {t('settings.data.launchLog.test')}
            </span>
          )}
        </span>
        <span className="truncate">{entry.profileName}</span>
        <span>
          {entry.endedAt === null
            ? t('settings.data.launchLog.unknown')
            : formatDuration(Date.parse(entry.endedAt) - Date.parse(entry.startedAt))}
        </span>
        <Outcome entry={entry} />
      </button>
      {expanded && (
        <div className="flex flex-col gap-2 bg-black/30 px-8 py-3">
          <code className="break-all text-emerald-200 select-text">
            {formatCommandLine(executable, args)}
          </code>
          <p className="text-slate-400">
            {t('settings.data.launchLog.cwd')} <code className="select-text">{entry.cwd}</code>
          </p>
          {entry.stderrTail && (
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-slate-300 select-text">
              {entry.stderrTail}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
