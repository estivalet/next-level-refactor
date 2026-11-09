import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { INPUT, parseExtensions } from './filterSystems.ts';

const BUTTON =
  'rounded-lg px-3 py-1.5 text-xs font-medium text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none';

/**
 * Settings → Systems → Add system (FR-EMU-11): the name and file extensions a new system needs;
 * everything else is filled in the editor that opens next.
 */
export function NewSystemForm({
  takenNames,
  onAdd,
  onCancel,
}: {
  /** Every system name in use, lower-case. */
  takenNames: ReadonlySet<string>;
  onAdd: (input: { name: string; extensions: string[] }) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const nameInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [extensions, setExtensions] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    nameInput.current?.focus();
  }, []);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    const parsed = parseExtensions(extensions);
    if (!trimmed) {
      setError('settings.systems.custom.nameRequired');
    } else if (takenNames.has(trimmed.toLowerCase())) {
      setError('settings.systems.custom.nameTaken');
    } else if (!parsed || parsed.some((ext) => !/^[a-z0-9]+$/.test(ext))) {
      setError('settings.systems.custom.extensionsRequired');
    } else {
      onAdd({ name: trimmed, extensions: parsed });
    }
  };

  return (
    <form
      aria-label={t('settings.systems.custom.addTitle')}
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-lg border border-white/20 bg-white/5 p-4"
    >
      <h4 className="text-sm font-semibold text-white">{t('settings.systems.custom.addTitle')}</h4>
      <label className="flex flex-col gap-1 text-xs text-slate-200" htmlFor={`${id}-name`}>
        {t('settings.systems.custom.name')}
        <input
          ref={nameInput}
          id={`${id}-name`}
          type="text"
          value={name}
          placeholder={t('settings.systems.custom.namePlaceholder')}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          className={INPUT}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-200" htmlFor={`${id}-ext`}>
        {t('settings.systems.extensions')}
        <input
          id={`${id}-ext`}
          type="text"
          value={extensions}
          placeholder="xci, nsp"
          aria-describedby={`${id}-ext-help`}
          onChange={(event) => {
            setExtensions(event.target.value);
            setError(null);
          }}
          className={INPUT}
        />
      </label>
      <p id={`${id}-ext-help`} className="text-xs text-slate-400">
        {t('settings.systems.custom.extensionsHelp')}
      </p>
      {error && (
        <p role="alert" className="text-xs text-[#ff8a80]">
          {t(error)}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className={`${BUTTON} bg-[#990033] hover:bg-[#b3003b]`}>
          {t('settings.systems.custom.add')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`${BUTTON} bg-white/10 hover:bg-white/20`}
        >
          {t('settings.systems.custom.cancel')}
        </button>
      </div>
    </form>
  );
}
