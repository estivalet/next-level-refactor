// Ported from NextLevelOS src/themes/components/StatusBar.tsx @ 3d530b7.
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from './cn.ts';

function useClock(intervalMs = 15_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date());
    }, intervalMs);
    return () => {
      window.clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}

/** A theme's status row: clock on the left, then the theme's own slots. */
export function StatusBar({
  left,
  right,
  showClock = true,
  className,
  clockClassName,
}: {
  left?: ReactNode;
  right?: ReactNode;
  showClock?: boolean;
  className?: string;
  clockClassName?: string;
}) {
  const { i18n } = useTranslation();
  const now = useClock();
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <div className="flex items-center gap-4">
        {showClock && (
          <span className={clockClassName}>
            {now.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {left}
      </div>
      <div className="flex items-center gap-4">{right}</div>
    </div>
  );
}
