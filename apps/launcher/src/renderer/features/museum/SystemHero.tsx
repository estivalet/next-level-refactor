import type { ReactNode } from 'react';
import { HardwareImage } from './HardwareImage.tsx';

/** The top of a system's page: name, "manufacturer · year" and its hardware picture (FR-MUS-9). */
export function SystemHero({
  name,
  subtitle,
  action,
}: {
  name: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <header
      data-testid="system-hero"
      className="flex shrink-0 items-center gap-6 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950/60 px-6 py-5"
    >
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-2xl font-semibold text-slate-50">{name}</h2>
        {subtitle && <p className="mt-1 truncate text-sm text-slate-400">{subtitle}</p>}
        {action && <div className="mt-4 flex gap-2">{action}</div>}
      </div>
      <HardwareImage name={name} size="hero" />
    </header>
  );
}
