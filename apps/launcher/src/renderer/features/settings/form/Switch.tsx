const FOCUS = 'focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none';

/** An on/off switch in the settings style (`role="switch"`). */
export function Switch({
  id,
  checked,
  onChange,
  labelledBy,
  label,
  describedBy,
  disabled,
}: {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  labelledBy?: string;
  /** Accessible name when no visible label names the switch. */
  label?: string;
  describedBy?: string | undefined;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => {
        onChange(!checked);
      }}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
        checked ? 'bg-[#990033]' : 'bg-white/20'
      } ${FOCUS}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
