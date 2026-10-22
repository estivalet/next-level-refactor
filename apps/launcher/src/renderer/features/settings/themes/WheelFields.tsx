import { HYPERSPIN_WHEEL_RANGES, type WheelNumericKey, type WheelOptions } from '@nextlevel/shared';
import type { WheelSettings } from '@nextlevel/themes';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

const INPUT =
  'w-24 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm text-white placeholder-slate-500 aria-[invalid=true]:border-[#ff8a80] focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none';

const NUMERIC_KEYS = Object.keys(HYPERSPIN_WHEEL_RANGES) as WheelNumericKey[];
const SIDES = ['top', 'right', 'bottom', 'left'] as const;

const step = ([min, max]: readonly [number, number]) => (max - min <= 3 ? 0.01 : 1);

/**
 * One HyperSpin wheel (`wheel` or `menuWheel`, FR-THM-4): every key with its range; an empty box
 * uses the value shown as its placeholder (the default, or for the menu wheel the game list
 * wheel's value).
 */
export function WheelFields({
  label,
  values,
  placeholder,
  errors,
  onChange,
}: {
  label: string;
  /** The user's keys of this wheel. */
  values: WheelOptions;
  /** What applies to each key left empty. */
  placeholder: WheelSettings;
  /** Error message keys by wheel key. */
  errors: Partial<Record<keyof WheelOptions, string>>;
  onChange: <K extends keyof WheelOptions>(key: K, value: WheelOptions[K] | undefined) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const keyLabel = (key: string) => t(`settings.themes.options.wheelKeys.${key}`);
  const number = (text: string) => (text.trim() === '' ? undefined : Number(text));
  const errorOf = (key: keyof WheelOptions, range?: readonly [number, number]) =>
    errors[key] &&
    (range
      ? t('settings.themes.options.range', { min: range[0], max: range[1] })
      : t(`settings.themes.options.wheelErrors.${key}`));
  const padding = values.padding ?? placeholder.padding;

  const field = (key: keyof WheelOptions, control: ReactNode, error: string | undefined) => (
    <div key={key} className="flex flex-col gap-1">
      <label htmlFor={`${id}-${key}`} className="text-xs text-slate-300">
        {keyLabel(key)}
      </label>
      {control}
      {error && (
        <p role="alert" className="text-xs text-[#ff8a80]">
          {error}
        </p>
      )}
    </div>
  );

  return (
    <fieldset aria-label={label} className="flex flex-col gap-2 border-b border-white/5 py-3">
      <legend className="text-sm font-medium text-white">{label}</legend>
      <div className="grid grid-cols-3 gap-3">
        {field(
          'width',
          <input
            id={`${id}-width`}
            value={values.width ?? ''}
            placeholder={placeholder.width}
            aria-invalid={errors.width ? true : undefined}
            onChange={(event) => {
              onChange('width', event.target.value.trim() === '' ? undefined : event.target.value);
            }}
            className={INPUT}
          />,
          errorOf('width'),
        )}
        {NUMERIC_KEYS.map((key) => {
          const range = HYPERSPIN_WHEEL_RANGES[key];
          return field(
            key,
            <input
              id={`${id}-${key}`}
              type="number"
              min={range[0]}
              max={range[1]}
              step={step(range)}
              value={values[key] ?? ''}
              placeholder={String(placeholder[key])}
              aria-invalid={errors[key] ? true : undefined}
              onChange={(event) => {
                onChange(key, number(event.target.value));
              }}
              className={INPUT}
            />,
            errorOf(key, range),
          );
        })}
        {field(
          'padding',
          <div className="flex gap-1">
            {SIDES.map((side, i) => (
              <input
                key={side}
                id={i === 0 ? `${id}-padding` : undefined}
                type="number"
                min={0}
                max={400}
                aria-label={t(`settings.themes.options.wheelKeys.padding${side}`)}
                value={values.padding ? String(padding[i]) : ''}
                placeholder={String(placeholder.padding[i])}
                aria-invalid={errors.padding ? true : undefined}
                onChange={(event) => {
                  const value = number(event.target.value);
                  if (value === undefined) {
                    onChange('padding', undefined);
                    return;
                  }
                  const next = [...padding] as [number, number, number, number];
                  next[i] = value;
                  onChange('padding', next);
                }}
                className="w-14 rounded-md border border-white/10 bg-black/30 px-1 py-1 text-sm text-white placeholder-slate-500 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
              />
            ))}
          </div>,
          errorOf('padding', [0, 400]),
        )}
      </div>
    </fieldset>
  );
}
