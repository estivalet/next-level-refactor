import {
  exclusionFolderOf,
  hasExclusion,
  ScanExclusionSchema,
  type ScanExclusion,
} from '@nextlevel/shared';
import { Asterisk, Folder, FolderPlus, X } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePickFolder } from '../settingsApi.ts';
import { INPUT } from './filterSystems.ts';

const BUTTON =
  'shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-50';

const textOf = (entry: ScanExclusion) => (entry.kind === 'pattern' ? entry.pattern : entry.path);

/** Why a typed pattern can't be added, as a message key; null when it can. */
function patternProblem(list: readonly ScanExclusion[], text: string): string | null {
  if (text.trim() === '') return null;
  const parsed = ScanExclusionSchema.safeParse({ kind: 'pattern', pattern: text });
  if (!parsed.success) return 'settings.systems.exclusions.invalidPattern';
  return hasExclusion(list, parsed.data) ? 'settings.systems.exclusions.duplicate' : null;
}

/**
 * Ignore when scanning (FR-LIB-15, US-D8): a system's own name patterns and folders the scan
 * skips. A picked folder must be inside the system's ROM folder in a storage location and is
 * kept relative to it. Empty means nothing is ignored (no system has a default).
 */
export function ScanExclusionsField({
  exclusions,
  systemDirs,
  error,
  onChange,
}: {
  exclusions: readonly ScanExclusion[] | undefined;
  /** The system's ROM folder in each storage location. */
  systemDirs: readonly string[];
  /** A saved-settings validation message key for this list, if any. */
  error: string | undefined;
  onChange: (next: ScanExclusion[] | undefined) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const pickFolder = usePickFolder();
  const list = exclusions ?? [];
  const [text, setText] = useState('');
  const [folderProblem, setFolderProblem] = useState<string | null>(null);
  const typedProblem = patternProblem(list, text);
  const canAdd = text.trim() !== '' && typedProblem === null;
  const problem = typedProblem ?? folderProblem ?? error ?? null;

  const save = (next: ScanExclusion[]) => {
    onChange(next.length > 0 ? next : undefined);
  };
  const addPattern = () => {
    if (!canAdd) return;
    save([...list, { kind: 'pattern', pattern: text.trim() }]);
    setText('');
    setFolderProblem(null);
  };
  const addFolder = () => {
    // Opens in the system's ROM folder: the first storage location that has it.
    const title = t('settings.systems.exclusions.pickTitle');
    pickFolder.mutate(
      { title, startIn: systemDirs },
      {
        onSuccess: (picked) => {
          if (!picked) return;
          const path = exclusionFolderOf(picked, systemDirs);
          if (path === null) {
            setFolderProblem('settings.systems.exclusions.outside');
          } else if (hasExclusion(list, { kind: 'folder', path })) {
            setFolderProblem('settings.systems.exclusions.duplicate');
          } else {
            setFolderProblem(null);
            save([...list, { kind: 'folder', path }]);
          }
        },
      },
    );
  };

  return (
    <fieldset
      role="group"
      aria-labelledby={`${id}-label`}
      aria-describedby={`${id}-help`}
      className="flex flex-col gap-2"
    >
      <legend id={`${id}-label`} className="text-xs text-slate-200">
        {t('settings.systems.exclusions.label')}
      </legend>
      <p id={`${id}-help`} className="text-xs text-slate-400">
        {t('settings.systems.exclusions.help')}
      </p>
      {list.length === 0 ? (
        <p className="text-xs text-slate-500">{t('settings.systems.exclusions.none')}</p>
      ) : (
        <ul aria-label={t('settings.systems.exclusions.list')} className="flex flex-col gap-1">
          {list.map((entry) => (
            <li
              key={`${entry.kind}:${textOf(entry)}`}
              className="flex items-center gap-2 rounded-md bg-black/20 px-2 py-1 text-xs text-slate-200"
            >
              {entry.kind === 'pattern' ? (
                <Asterisk aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              ) : (
                <Folder aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              )}
              <span className="sr-only">
                {t(
                  entry.kind === 'pattern'
                    ? 'settings.systems.exclusions.patternKind'
                    : 'settings.systems.exclusions.folderKind',
                )}
              </span>
              <span className="flex-1 font-mono break-all">{textOf(entry)}</span>
              <button
                type="button"
                aria-label={t('settings.systems.exclusions.remove', { entry: textOf(entry) })}
                onClick={() => {
                  setFolderProblem(null);
                  save(list.filter((item) => item !== entry));
                }}
                className="rounded p-0.5 text-slate-400 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          aria-label={t('settings.systems.exclusions.pattern')}
          placeholder={t('settings.systems.exclusions.patternPlaceholder')}
          value={text}
          aria-invalid={typedProblem ? true : undefined}
          aria-describedby={problem ? `${id}-problem` : undefined}
          onChange={(event) => {
            setText(event.target.value);
            setFolderProblem(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addPattern();
            }
          }}
          className={`${INPUT} min-w-0 flex-1 font-mono`}
        />
        <button type="button" className={BUTTON} disabled={!canAdd} onClick={addPattern}>
          {t('settings.systems.exclusions.addPattern')}
        </button>
        <button
          type="button"
          className={`${BUTTON} flex items-center gap-1`}
          disabled={pickFolder.isPending || systemDirs.length === 0}
          title={systemDirs.length === 0 ? t('settings.systems.exclusions.noLocations') : undefined}
          onClick={addFolder}
        >
          <FolderPlus aria-hidden="true" className="h-3.5 w-3.5" />
          {t('settings.systems.exclusions.addFolder')}
        </button>
      </div>
      {problem && (
        <p id={`${id}-problem`} className="text-xs text-[#ff8a80]">
          {t(problem)}
        </p>
      )}
    </fieldset>
  );
}
