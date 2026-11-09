import {
  SYSTEM_KINDS,
  type CustomSystem,
  type EmulatorProfile,
  type SystemSettings,
} from '@nextlevel/shared';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { CustomSystemPatch } from './customSystemsDraft.ts';
import { INPUT, parseExtensions } from './filterSystems.ts';

const BUTTON =
  'w-fit rounded-lg px-3 py-1.5 text-xs font-medium text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none';

type TextKey = 'name' | 'shortName' | 'manufacturer' | 'folderName' | 'launchboxPlatform';

/**
 * Settings → Systems: every detail of a system the user added (FR-EMU-11), its emulator profile
 * (FR-EMU-4) and Delete. Shipped systems use SystemEditor, which only overrides.
 */
export function CustomSystemEditor({
  system,
  index,
  settings,
  profiles,
  errors,
  scan,
  onChange,
  onProfileChange,
  onDelete,
  onClose,
}: {
  system: CustomSystem;
  /** Its position in `customSystems`, for error paths. */
  index: number;
  settings: SystemSettings | undefined;
  profiles: readonly EmulatorProfile[];
  errors: Record<string, string>;
  /** Scan this system (FR-LIB-3). */
  scan: ReactNode;
  onChange: (patch: CustomSystemPatch) => void;
  onProfileChange: (profileId: string | undefined) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const nameInput = useRef<HTMLInputElement>(null);
  const [extensionsText, setExtensionsText] = useState(system.extensions.join(', '));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const base = `customSystems.${String(index)}`;
  const errorOf = (key: string) =>
    Object.entries(errors).find(
      ([path]) => path === `${base}.${key}` || path.startsWith(`${base}.${key}.`),
    )?.[1];

  useEffect(() => {
    nameInput.current?.focus();
  }, []);

  const field = (key: string, label: string, control: ReactNode, help?: string) => {
    const error = errorOf(key);
    return (
      <div className="flex flex-col gap-1">
        <label className="flex flex-col gap-1 text-xs text-slate-200" htmlFor={`${id}-${key}`}>
          {label}
          {control}
        </label>
        {help && (
          <p id={`${id}-${key}-help`} className="text-xs text-slate-400">
            {help}
          </p>
        )}
        {error && <p className="text-xs text-[#ff8a80]">{t(error)}</p>}
      </div>
    );
  };

  const text = (key: TextKey, label: string, help?: string) =>
    field(
      key,
      label,
      <input
        ref={key === 'name' ? nameInput : undefined}
        id={`${id}-${key}`}
        type="text"
        value={system[key] ?? ''}
        aria-describedby={help ? `${id}-${key}-help` : undefined}
        aria-invalid={errorOf(key) ? true : undefined}
        onChange={(event) => {
          const value = event.target.value;
          const required = key === 'name' || key === 'folderName';
          onChange({ [key]: required || value.trim() !== '' ? value : undefined });
        }}
        className={INPUT}
      />,
      help,
    );

  const number = (key: 'releaseYear' | 'screenscraperId', label: string, help?: string) =>
    field(
      key,
      label,
      <input
        id={`${id}-${key}`}
        type="number"
        min={key === 'releaseYear' ? 1950 : 1}
        step={1}
        value={system[key] ?? ''}
        aria-describedby={help ? `${id}-${key}-help` : undefined}
        aria-invalid={errorOf(key) ? true : undefined}
        onChange={(event) => {
          const value = event.target.value;
          onChange({ [key]: value === '' ? undefined : Number(value) });
        }}
        className={INPUT}
      />,
      help,
    );

  return (
    <section
      aria-label={system.name || t('settings.systems.custom.untitled')}
      className="flex flex-col gap-3 rounded-lg border border-white/20 bg-white/5 p-4"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">
          {system.name || t('settings.systems.custom.untitled')}{' '}
          <span className="text-xs font-normal text-slate-400">
            {t('settings.systems.custom.badge')} · {system.id}
          </span>
        </h4>
        <button
          type="button"
          aria-label={t('settings.systems.close')}
          onClick={onClose}
          className="rounded-lg p-1 text-slate-300 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {text('name', t('settings.systems.custom.name'))}
        {text('shortName', t('settings.systems.custom.shortName'))}
        {text('manufacturer', t('settings.systems.custom.manufacturer'))}
        {number('releaseYear', t('settings.systems.custom.releaseYear'))}
      </div>
      {field(
        'kind',
        t('settings.systems.custom.kind'),
        <select
          id={`${id}-kind`}
          value={system.kind}
          onChange={(event) => {
            onChange({ kind: event.target.value as CustomSystem['kind'] });
          }}
          className={INPUT}
        >
          {SYSTEM_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`settings.systems.custom.kinds.${kind}`)}
            </option>
          ))}
        </select>,
      )}
      {field(
        'description',
        t('settings.systems.custom.description'),
        <textarea
          id={`${id}-description`}
          rows={3}
          value={system.description ?? ''}
          aria-invalid={errorOf('description') ? true : undefined}
          onChange={(event) => {
            const value = event.target.value;
            onChange({ description: value.trim() === '' ? undefined : value });
          }}
          className={INPUT}
        />,
      )}
      {text(
        'folderName',
        t('settings.systems.folderName'),
        t('settings.systems.custom.folderHelp'),
      )}
      {field(
        'extensions',
        t('settings.systems.extensions'),
        <input
          id={`${id}-extensions`}
          type="text"
          value={extensionsText}
          aria-describedby={`${id}-extensions-help`}
          aria-invalid={errorOf('extensions') ? true : undefined}
          onChange={(event) => {
            setExtensionsText(event.target.value);
            onChange({ extensions: parseExtensions(event.target.value) ?? [] });
          }}
          className={INPUT}
        />,
        t('settings.systems.custom.extensionsHelp'),
      )}
      {number(
        'screenscraperId',
        t('settings.systems.screenscraperId'),
        t('settings.systems.custom.screenscraperHelp'),
      )}
      {text('launchboxPlatform', t('settings.systems.launchboxPlatform'))}
      {field(
        'profile',
        t('settings.systems.defaultProfile'),
        <select
          id={`${id}-profile`}
          value={
            profiles.some((p) => p.id === settings?.defaultProfileId)
              ? settings?.defaultProfileId
              : ''
          }
          onChange={(event) => {
            onProfileChange(event.target.value || undefined);
          }}
          className={INPUT}
        >
          <option value="">{t('settings.systems.defaultProfileAuto')}</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>,
        profiles.length === 0 ? t('settings.systems.custom.noProfiles') : undefined,
      )}
      {scan}
      {confirmingDelete ? (
        <div
          role="group"
          aria-label={t('settings.systems.custom.deleteTitle')}
          className="flex flex-col gap-2"
        >
          <p className="text-xs text-slate-200">
            {t('settings.systems.custom.deleteConfirm', { name: system.name })}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDelete}
              className={`${BUTTON} bg-[#990033] hover:bg-[#b3003b]`}
            >
              {t('settings.systems.custom.deleteYes')}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmingDelete(false);
              }}
              className={`${BUTTON} bg-white/10 hover:bg-white/20`}
            >
              {t('settings.systems.custom.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setConfirmingDelete(true);
          }}
          className={`${BUTTON} bg-white/10 hover:bg-white/20`}
        >
          {t('settings.systems.custom.delete')}
        </button>
      )}
    </section>
  );
}
