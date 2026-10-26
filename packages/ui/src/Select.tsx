import { useId, type SelectHTMLAttributes } from 'react';

/** A labelled native select (keyboard and screen-reader friendly by default). */
export function Select({
  label,
  options,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-slate-300">
        {label}
      </label>
      <select
        id={id}
        className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
