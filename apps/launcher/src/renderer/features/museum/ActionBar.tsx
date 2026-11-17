import type { ReactNode } from 'react';

/**
 * A footer that stays put under a scrolling page (FR-MUS-9). Render it as a sibling after the
 * scroll container, never inside it, so content never scrolls beneath the buttons.
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-white/10 bg-[#14141c] px-5 py-3">
      {children}
    </div>
  );
}
