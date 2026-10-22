import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { INPUT, SECONDARY_BUTTON } from '../../library/Modal.tsx';
import { TokenInput } from './TokenInput.tsx';

/** A profile's extra environment variables (FR-EMU-2); values are templates. */
export function EnvEditor({
  env,
  errors,
  onChange,
}: {
  env: Readonly<Record<string, string>>;
  /** Message keys by variable name, from the settings validation. */
  errors: Readonly<Record<string, string>>;
  onChange: (env: Record<string, string>) => void;
}) {
  const { t } = useTranslation();
  const entries = Object.entries(env);
  const replace = (index: number, name: string, value: string) => {
    onChange(Object.fromEntries(entries.map((entry, i) => (i === index ? [name, value] : entry))));
  };

  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-[11px] text-slate-400">
        {t('settings.emulators.editor.env')}
      </legend>
      {entries.map(([name, value], index) => (
        // Keyed by position: renaming a variable must keep the row and its focus.
        <div key={index} className="flex items-start gap-1">
          <div className="w-40 shrink-0">
            <input
              type="text"
              value={name}
              aria-label={t('settings.emulators.editor.envName')}
              aria-invalid={errors[name] ? true : undefined}
              onChange={(event) => {
                replace(index, event.target.value, value);
              }}
              className={`${INPUT} font-mono`}
            />
            {errors[name] && <p className="mt-1 text-[11px] text-red-300">{t(errors[name])}</p>}
          </div>
          <TokenInput
            value={value}
            where="value"
            label={t('settings.emulators.editor.envValue', { name })}
            onChange={(next) => {
              replace(index, name, next);
            }}
          />
          <button
            type="button"
            aria-label={t('settings.emulators.editor.removeEnv', { name })}
            className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white"
            onClick={() => {
              onChange(Object.fromEntries(entries.filter((_, i) => i !== index)));
            }}
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className={`${SECONDARY_BUTTON} w-fit`}
        onClick={() => {
          let n = entries.length + 1;
          while (`VAR${String(n)}` in env) n += 1;
          onChange({ ...env, [`VAR${String(n)}`]: '' });
        }}
      >
        {t('settings.emulators.editor.addEnv')}
      </button>
    </fieldset>
  );
}
