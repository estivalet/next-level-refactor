// Ported from NextLevelOS src/themes/components/TabBar.tsx @ 3d530b7.
import type { ReactNode } from 'react';
import { cn } from './cn.ts';

export interface TabBarItem {
  id: string;
  label: string;
  count?: number;
}

/** A row of tabs; a click selects one (FR-THM-3). */
export function TabBar({
  tabs,
  activeId,
  onChange,
  prevHint,
  nextHint,
  className,
  tabClassName,
  activeTabClassName,
}: {
  tabs: TabBarItem[];
  activeId: string;
  onChange: (id: string) => void;
  prevHint?: ReactNode;
  nextHint?: ReactNode;
  className?: string;
  tabClassName?: string;
  activeTabClassName?: string;
}) {
  return (
    <div role="tablist" className={cn('flex items-center', className)}>
      {prevHint}
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={-1}
            onClick={() => {
              onChange(tab.id);
            }}
            className={cn(tabClassName, active && activeTabClassName)}
          >
            {tab.label}
            {tab.count !== undefined && <span className="ml-1.5 opacity-60">{tab.count}</span>}
          </button>
        );
      })}
      {nextHint}
    </div>
  );
}
