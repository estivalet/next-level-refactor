import { KIOSK_HIDE, type KioskHide, type KioskState } from '@nextlevel/shared';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfigureKiosk, useKioskState, useLockKiosk } from '../kiosk/kioskApi.ts';
import { Switch } from './form/Switch.tsx';

const BUTTON =
  'rounded-lg px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-50';
const PIN = /^\d{4,8}$/;

/**
 * Settings → Kiosk (FR-SET-6, US-D4, D54): turn kiosk mode on with a PIN typed twice, pick what
 * it hides, change the PIN, and Lock now. Saved through `kiosk.configure`, never the settings
 * form: main owns the kiosk section.
 */
export function KioskSection() {
  const state = useKioskState().data;
  if (!state) return null;
  // Remount when main's state changes, so the form starts from it.
  return <KioskForm key={JSON.stringify(state)} saved={state} />;
}

function KioskForm({ saved }: { saved: KioskState }) {
  const { t } = useTranslation();
  const id = useId();
  const configure = useConfigureKiosk();
  const lock = useLockKiosk();
  const [enabled, setEnabled] = useState(saved.enabled);
  const [hide, setHide] = useState<KioskHide[]>(saved.hide);
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');

  // A new PIN is needed to turn kiosk on; once on, the fields are optional (they change it).
  const needsPin = enabled && !saved.enabled;
  const typed = pin !== '' || again !== '';
  const pinError =
    !typed && !needsPin
      ? null
      : !PIN.test(pin)
        ? 'settings.kiosk.pinFormat'
        : pin !== again
          ? 'settings.kiosk.pinMismatch'
          : null;
  const ordered = KIOSK_HIDE.filter((part) => hide.includes(part));
  const changed =
    enabled !== saved.enabled || ordered.join() !== saved.hide.join() || (typed && enabled);
  const digits = (value: string) => value.replace(/\D/g, '').slice(0, 8);

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-6">
      <div className="flex items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <span id={`${id}-label`} className="text-sm font-medium text-white">
            {t('settings.kiosk.enabled')}
          </span>
          <p id={`${id}-help`} className="text-xs text-slate-400">
            {t('settings.kiosk.help')}
          </p>
        </div>
        <Switch
          checked={enabled}
          labelledBy={`${id}-label`}
          describedBy={`${id}-help`}
          onChange={setEnabled}
        />
      </div>

      {enabled && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-400">
            {t(saved.enabled ? 'settings.kiosk.changePin' : 'settings.kiosk.newPinHelp')}
          </p>
          {(['pin', 'again'] as const).map((field) => (
            <label key={field} className="flex flex-col gap-1 text-xs font-medium text-slate-300">
              {t(field === 'pin' ? 'settings.kiosk.newPin' : 'settings.kiosk.pinAgain')}
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={field === 'pin' ? pin : again}
                onChange={(event) => {
                  (field === 'pin' ? setPin : setAgain)(digits(event.target.value));
                }}
                className="w-40 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white"
              />
            </label>
          ))}
          {pinError && (pin.length > 0 || again.length > 0) && again.length >= pin.length && (
            <p role="alert" className="text-xs text-[#ff8a80]">
              {t(pinError)}
            </p>
          )}
        </div>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-white">{t('settings.kiosk.hide')}</legend>
        {KIOSK_HIDE.map((part) => (
          <label key={part} className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={hide.includes(part)}
              onChange={(event) => {
                setHide((current) =>
                  event.target.checked
                    ? [...current, part]
                    : current.filter((other) => other !== part),
                );
              }}
            />
            {t(`settings.kiosk.parts.${part}`)}
          </label>
        ))}
        <p className="text-xs text-slate-400">{t('settings.kiosk.unlockHelp')}</p>
      </fieldset>

      {configure.error && (
        <p role="alert" className="text-sm text-[#ff8a80]">
          {t('settings.kiosk.saveFailed')}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          className={`${BUTTON} bg-[#990033] text-white hover:bg-[#b3003c]`}
          disabled={!changed || pinError !== null || configure.isPending}
          onClick={() => {
            configure.mutate({
              enabled,
              hide: ordered,
              ...(enabled && typed ? { pin } : {}),
            });
          }}
        >
          {t('settings.kiosk.save')}
        </button>
        {saved.enabled && (
          <button
            type="button"
            className={`${BUTTON} bg-white/10 text-white hover:bg-white/20`}
            disabled={lock.isPending}
            onClick={() => {
              lock.mutate(undefined);
            }}
          >
            {t('settings.kiosk.lockNow')}
          </button>
        )}
      </div>
    </div>
  );
}
