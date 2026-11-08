import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface MenuAction {
  key: string;
  label: string;
  run: () => void;
}

/** A button that opens a small menu of actions (same pattern as the Library's Scan ▾). */
export function ActionMenu({
  label,
  menuLabel,
  buttonClassName,
  children,
  actions,
}: {
  /** The button's accessible name. */
  label: string;
  menuLabel: string;
  buttonClassName: string;
  /** The button's visible content. */
  children: ReactNode;
  actions: readonly MenuAction[];
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const outside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    return () => {
      document.removeEventListener('mousedown', outside);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={buttonClassName}
        onClick={() => {
          setOpen(!open);
        }}
      >
        {children}
      </button>
      {open && (
        <div
          role="menu"
          aria-label={menuLabel}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
          className="absolute top-full right-0 z-30 mt-1 min-w-44 rounded-lg border border-white/10 bg-[#1a1a24] py-1 text-xs text-slate-300 shadow-2xl"
        >
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                action.run();
              }}
              className="flex w-full px-4 py-2 text-left hover:bg-white/10 hover:text-white focus:bg-white/10 focus:outline-none"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
