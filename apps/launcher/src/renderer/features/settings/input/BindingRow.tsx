import { bindingLabel, type InputAction } from '@nextlevel/shared';
import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Device = 'keyboard' | 'gamepad';

const CHIP = 'flex items-center gap-1 rounded-md bg-white/10 py-0.5 pr-0.5 pl-2 text-xs text-white';
const SMALL_BUTTON =
  'rounded p-0.5 text-slate-300 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none';
const ADD_BUTTON =
  'flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none';

interface BindingRowProps {
  action: InputAction;
  keyboard: readonly string[];
  gamepad: readonly string[];
  /** The device being captured for this row, if any. */
  capturing: Device | null;
  error: string | undefined;
  onAdd: (device: Device) => void;
  onRemove: (device: Device, index: number) => void;
}

/** One action in Settings → Input: its keys and buttons, each removable, plus Add (FR-THM-3). */
export function BindingRow(props: BindingRowProps) {
  const { t } = useTranslation();
  const name = t(`settings.input.actions.${props.action}`);

  const column = (device: Device, bindings: readonly string[]) => (
    <div className="flex flex-wrap items-center gap-1.5">
      {bindings.map((binding, index) => {
        const label = bindingLabel(device, binding);
        return (
          <span key={binding} className={CHIP}>
            {label}
            <button
              type="button"
              className={SMALL_BUTTON}
              aria-label={t('settings.input.remove', { binding: label, action: name })}
              onClick={() => {
                props.onRemove(device, index);
              }}
            >
              <X aria-hidden="true" className="h-3 w-3" />
            </button>
          </span>
        );
      })}
      {props.capturing === device ? (
        <span role="status" className="text-xs text-amber-200">
          {t(device === 'keyboard' ? 'settings.input.pressKey' : 'settings.input.pressButton')}
        </span>
      ) : (
        <button
          type="button"
          className={ADD_BUTTON}
          aria-label={t(
            device === 'keyboard' ? 'settings.input.addKey' : 'settings.input.addButton',
            { action: name },
          )}
          onClick={() => {
            props.onAdd(device);
          }}
        >
          <Plus aria-hidden="true" className="h-3 w-3" />
          {t('settings.input.add')}
        </button>
      )}
    </div>
  );

  return (
    <fieldset className="grid grid-cols-[10rem_1fr_1fr] items-start gap-3 border-b border-white/5 py-2">
      <legend className="sr-only">{name}</legend>
      <span aria-hidden="true" className="pt-0.5 text-sm text-slate-200">
        {name}
      </span>
      {column('keyboard', props.keyboard)}
      {column('gamepad', props.gamepad)}
      {props.error && <p className="col-span-3 text-xs text-[#ff8a80]">{t(props.error)}</p>}
    </fieldset>
  );
}
