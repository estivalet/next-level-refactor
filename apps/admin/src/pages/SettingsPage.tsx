import { EmailSchema, SIGN_UP_MODES, type AppSettingsPatch } from '@nextlevel/shared';
import { Button, TextArea, TextField } from '@nextlevel/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSettings, useSaveAppSettings } from '../api/hooks.ts';
import { errorKey } from '../errors.ts';

type Settings = NonNullable<ReturnType<typeof useAppSettings>['data']>;

/** S13 Settings (FR-ADM-4): grace days, sign-up mode, allow-list, maintenance banner. */
export function SettingsPage() {
  const { t } = useTranslation();
  const settings = useAppSettings();
  const [justSaved, setJustSaved] = useState(false);
  if (settings.isError) {
    return (
      <p role="alert" className="text-sm text-[#ff8a80]">
        {t(errorKey(settings.error))}
      </p>
    );
  }
  // Remount the form when the saved settings change, so it starts from them.
  return settings.data ? (
    <SettingsForm
      key={JSON.stringify(settings.data)}
      saved={settings.data}
      justSaved={justSaved}
      onSaved={() => {
        setJustSaved(true);
      }}
    />
  ) : null;
}

function SettingsForm({
  saved,
  justSaved,
  onSaved,
}: {
  saved: Settings;
  justSaved: boolean;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const save = useSaveAppSettings();
  const [grace, setGrace] = useState(String(saved.graceDays));
  const [mode, setMode] = useState(saved.signUpMode);
  const [list, setList] = useState(saved.allowList.join('\n'));
  const [banner, setBanner] = useState(saved.banner ?? '');

  // Normalized as the server does (trimmed, lowercased, once each), so equal lists compare equal.
  const lines = [
    ...new Set(
      list
        .split('\n')
        .map((line) => line.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  const invalid = lines.filter((line) => !EmailSchema.safeParse(line).success);
  const graceDays = Number(grace);
  const graceOk = Number.isInteger(graceDays) && graceDays >= 1 && graceDays <= 30;
  const patch: AppSettingsPatch = {
    ...(graceDays !== saved.graceDays ? { graceDays } : {}),
    ...(mode !== saved.signUpMode ? { signUpMode: mode } : {}),
    ...(lines.join('\n') !== saved.allowList.join('\n') ? { allowList: lines } : {}),
    ...((banner.trim() || null) !== saved.banner ? { banner: banner.trim() || null } : {}),
  };
  const changed = Object.keys(patch).length > 0;

  return (
    <form
      className="flex max-w-xl flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(patch, { onSuccess: onSaved });
      }}
    >
      <h1 className="text-lg font-semibold text-white">{t('admin.settings.title')}</h1>
      <TextField
        label={t('admin.settings.graceDays')}
        help={t('admin.settings.graceHelp')}
        type="number"
        min={1}
        max={30}
        value={grace}
        onChange={(event) => {
          setGrace(event.target.value);
        }}
      />
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs font-medium text-slate-300">
          {t('admin.settings.signUpMode')}
        </legend>
        {SIGN_UP_MODES.map((value) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="signUpMode"
              checked={mode === value}
              onChange={() => {
                setMode(value);
              }}
            />
            {t(`admin.settings.modes.${value}`)}
          </label>
        ))}
      </fieldset>
      <TextArea
        label={t('admin.settings.allowList')}
        value={list}
        error={
          invalid.length > 0
            ? t('admin.settings.invalidEmails', { lines: invalid.join(', ') })
            : null
        }
        onChange={(event) => {
          setList(event.target.value);
        }}
      />
      <TextField
        label={t('admin.settings.banner')}
        help={t('admin.settings.bannerCount', { count: banner.length })}
        maxLength={280}
        value={banner}
        onChange={(event) => {
          setBanner(event.target.value);
        }}
      />
      {save.error && (
        <p role="alert" className="text-sm text-[#ff8a80]">
          {t(errorKey(save.error))}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          disabled={!changed || !graceOk || invalid.length > 0 || save.isPending}
        >
          {t('admin.settings.save')}
        </Button>
        {justSaved && !changed && (
          <p role="status" className="text-sm text-emerald-300">
            {t('admin.settings.saved')}
          </p>
        )}
      </div>
    </form>
  );
}
