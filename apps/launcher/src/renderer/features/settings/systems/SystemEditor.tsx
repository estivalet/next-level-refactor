import type { EmulatorProfile, SystemDefinition, SystemSettings } from '@nextlevel/shared';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** "z64, .N64  zip" → ['z64', 'n64', 'zip']; empty → undefined (use the catalog's list). */
function parseExtensions(text: string): string[] | undefined {
  const list = text
    .split(/[\s,]+/)
    .map((e) => e.replace(/^\./, '').toLowerCase())
    .filter(Boolean);
  return list.length > 0 ? list : undefined;
}

const INPUT =
  'w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm text-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none';

/**
 * Per-system overrides: ROM folder name and file extensions (FR-LIB-2), ScreenScraper id
 * (data model §6), default profile (FR-EMU-4).
 */
export function SystemEditor({
  system,
  settings,
  profiles,
  errors,
  onChange,
  onReset,
  onClose,
}: {
  system: SystemDefinition;
  settings: SystemSettings | undefined;
  /** The profiles that cover this system. */
  profiles: readonly EmulatorProfile[];
  errors: Record<string, string>;
  onChange: (
    patch: Partial<
      Pick<SystemSettings, 'folderName' | 'extensions' | 'defaultProfileId' | 'screenscraperId'>
    >,
  ) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const folderInput = useRef<HTMLInputElement>(null);
  const [extensionsText, setExtensionsText] = useState(settings?.extensions?.join(', ') ?? '');
  // The box keeps what the user typed, but follows the draft when it changes elsewhere
  // (Discard, Reset): adjust state during render when the draft value moved under it.
  const [shownFor, setShownFor] = useState(settings?.extensions);
  if (settings?.extensions !== shownFor) {
    setShownFor(settings?.extensions);
    const typed = parseExtensions(extensionsText);
    if (typed?.join(',') !== settings?.extensions?.join(',')) {
      setExtensionsText(settings?.extensions?.join(', ') ?? '');
    }
  }
  const base = `systems.${system.id}`;
  const folderError = errors[`${base}.folderName`];
  const scraperError = errors[`${base}.screenscraperId`];
  const catalogScraperId = system.scraper.screenscraperId;
  const extensionsError = Object.entries(errors).find(([path]) =>
    path.startsWith(`${base}.extensions`),
  )?.[1];

  useEffect(() => {
    folderInput.current?.focus();
  }, []);

  return (
    <section
      aria-label={system.name}
      className="flex flex-col gap-3 rounded-lg border border-white/20 bg-white/5 p-4"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">{system.name}</h4>
        <button
          type="button"
          aria-label={t('settings.systems.close')}
          onClick={onClose}
          className="rounded-lg p-1 text-slate-300 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <label className="flex flex-col gap-1 text-xs text-slate-200" htmlFor={`${id}-folder`}>
        {t('settings.systems.folderName')}
        <input
          ref={folderInput}
          id={`${id}-folder`}
          type="text"
          value={settings?.folderName ?? ''}
          placeholder={system.defaultFolderName}
          aria-describedby={`${id}-folder-help`}
          aria-invalid={folderError ? true : undefined}
          onChange={(event) => {
            onChange({ folderName: event.target.value === '' ? undefined : event.target.value });
          }}
          className={INPUT}
        />
      </label>
      <p id={`${id}-folder-help`} className="text-xs text-slate-400">
        {t('settings.systems.folderHelp', { default: system.defaultFolderName })}
      </p>
      {folderError && <p className="text-xs text-[#ff8a80]">{t(folderError)}</p>}
      <label className="flex flex-col gap-1 text-xs text-slate-200" htmlFor={`${id}-ext`}>
        {t('settings.systems.extensions')}
        <input
          id={`${id}-ext`}
          type="text"
          value={extensionsText}
          placeholder={system.extensions.join(', ')}
          aria-describedby={`${id}-ext-help`}
          aria-invalid={extensionsError ? true : undefined}
          onChange={(event) => {
            setExtensionsText(event.target.value);
            onChange({ extensions: parseExtensions(event.target.value) });
          }}
          className={INPUT}
        />
      </label>
      <p id={`${id}-ext-help`} className="text-xs text-slate-400">
        {t('settings.systems.extensionsHelp', { default: system.extensions.join(', ') })}
      </p>
      {extensionsError && <p className="text-xs text-[#ff8a80]">{t(extensionsError)}</p>}
      <label className="flex flex-col gap-1 text-xs text-slate-200" htmlFor={`${id}-scraper`}>
        {t('settings.systems.screenscraperId')}
        <input
          id={`${id}-scraper`}
          type="number"
          min={1}
          step={1}
          value={settings?.screenscraperId ?? ''}
          placeholder={catalogScraperId === undefined ? '' : String(catalogScraperId)}
          aria-describedby={`${id}-scraper-help`}
          aria-invalid={scraperError ? true : undefined}
          onChange={(event) => {
            const value = event.target.value;
            onChange({ screenscraperId: value === '' ? undefined : Number(value) });
          }}
          className={INPUT}
        />
      </label>
      <p id={`${id}-scraper-help`} className="text-xs text-slate-400">
        {catalogScraperId === undefined
          ? t('settings.systems.screenscraperHelpNone')
          : t('settings.systems.screenscraperHelp', { default: catalogScraperId })}
      </p>
      {scraperError && <p className="text-xs text-[#ff8a80]">{t(scraperError)}</p>}
      <label className="flex flex-col gap-1 text-xs text-slate-200" htmlFor={`${id}-profile`}>
        {t('settings.systems.defaultProfile')}
        <select
          id={`${id}-profile`}
          value={
            profiles.some((p) => p.id === settings?.defaultProfileId)
              ? settings?.defaultProfileId
              : ''
          }
          onChange={(event) => {
            onChange({ defaultProfileId: event.target.value || undefined });
          }}
          className={INPUT}
        >
          <option value="">{t('settings.systems.defaultProfileAuto')}</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => {
          setExtensionsText('');
          onReset();
        }}
        className="w-fit rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
      >
        {t('settings.systems.reset')}
      </button>
    </section>
  );
}
