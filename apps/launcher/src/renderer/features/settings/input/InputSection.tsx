import {
  defaultSettings,
  INPUT_ACTIONS,
  type InputAction,
  type InputSettings,
  type Settings,
} from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import { SettingsSection } from '../form/SettingsSection.tsx';
import type { SettingsDraft } from '../form/useSettingsDraft.ts';
import { BindingRow } from './BindingRow.tsx';
import { useBindingCapture } from './useBindingCapture.ts';

type Device = 'keyboard' | 'gamepad';

function withBindings(
  settings: Settings,
  device: Device,
  action: InputAction,
  change: (bindings: string[]) => string[],
): Settings {
  const map = settings.input[device];
  return {
    ...settings,
    input: { ...settings.input, [device]: { ...map, [action]: change(map[action]) } },
  };
}

/** The first validation message for any binding of this action. */
function rowError(errors: Record<string, string>, action: InputAction): string | undefined {
  const prefixes = [`input.keyboard.${action}.`, `input.gamepad.${action}.`];
  const path = Object.keys(errors).find((p) => prefixes.some((prefix) => p.startsWith(prefix)));
  return path ? errors[path] : undefined;
}

const NUMBER_INPUT =
  'w-24 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm text-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none';

/** Settings → Input (FR-THM-3, US-C1): keys and gamepad buttons per action, repeat timing. */
export function InputSection() {
  return <SettingsSection>{(draft) => <InputForm {...draft} />}</SettingsSection>;
}

function InputForm({ draft, update, errors }: SettingsDraft) {
  const { t } = useTranslation();
  const { capture, start } = useBindingCapture((target, binding) => {
    update((current) =>
      withBindings(current, target.device, target.action, (list) =>
        list.includes(binding) ? list : [...list, binding],
      ),
    );
  });
  const input = draft.input;
  const setRepeat = (key: 'repeatDelayMs' | 'repeatRateHz', value: string) => {
    update((current) => ({ ...current, input: { ...current.input, [key]: Number(value) } }));
  };

  return (
    <div className="flex flex-col gap-4 py-4">
      <p className="text-sm text-slate-300">{t('settings.input.intro')}</p>
      <div className="grid grid-cols-[10rem_1fr_1fr] gap-3 text-xs font-medium text-slate-400">
        <span>{t('settings.input.action')}</span>
        <span>{t('settings.input.keys')}</span>
        <span>{t('settings.input.buttons')}</span>
      </div>
      <div>
        {INPUT_ACTIONS.map((action) => (
          <BindingRow
            key={action}
            action={action}
            keyboard={input.keyboard[action]}
            gamepad={input.gamepad[action]}
            capturing={capture.target?.action === action ? capture.target.device : null}
            error={rowError(errors, action)}
            onAdd={(device) => {
              start({ action, device });
            }}
            onRemove={(device, index) => {
              update((current) =>
                withBindings(current, device, action, (list) => list.filter((_, i) => i !== index)),
              );
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-6">
        {(['repeatDelayMs', 'repeatRateHz'] as const satisfies (keyof InputSettings)[]).map(
          (key) => (
            <label key={key} className="flex flex-col gap-1 text-xs text-slate-300">
              {t(`settings.input.${key}`)}
              <input
                type="number"
                value={input[key]}
                aria-invalid={errors[`input.${key}`] ? true : undefined}
                onChange={(event) => {
                  setRepeat(key, event.target.value);
                }}
                className={NUMBER_INPUT}
              />
              {errors[`input.${key}`] && (
                <span className="text-[#ff8a80]">{t(errors[`input.${key}`] ?? '')}</span>
              )}
            </label>
          ),
        )}
        <button
          type="button"
          onClick={() => {
            update((current) => ({ ...current, input: defaultSettings().input }));
          }}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        >
          {t('settings.input.reset')}
        </button>
      </div>
    </div>
  );
}
