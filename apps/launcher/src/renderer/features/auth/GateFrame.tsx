import type { ReactNode } from 'react';

export const GATE_BUTTON =
  'rounded-lg px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50';
export const PRIMARY = `${GATE_BUTTON} bg-[#990033] text-white hover:bg-[#b3003c]`;
export const SECONDARY = `${GATE_BUTTON} bg-white/10 text-slate-200 hover:bg-white/15`;

/** The gate layer's frame (IA §1): the NextLevel card over the shell's gradient, with the banner. */
export function GateFrame({
  title,
  banner,
  children,
}: {
  title: string;
  banner: string | null;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#1e1b4b] p-6 text-slate-200">
      {banner && (
        <p
          role="note"
          className="max-w-lg rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm text-amber-100"
        >
          {banner}
        </p>
      )}
      <section
        aria-labelledby="gate-title"
        className="flex w-full max-w-lg flex-col gap-4 rounded-2xl border border-white/10 bg-[#1a1c23]/95 p-8 shadow-2xl"
      >
        <p className="text-sm font-bold tracking-[0.3em] text-slate-400">NEXTLEVEL</p>
        <h1 id="gate-title" className="text-xl font-semibold text-white">
          {title}
        </h1>
        {children}
      </section>
    </div>
  );
}
