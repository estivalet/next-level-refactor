// Ported from NextLevelOS src/themes/components/HintBar.tsx @ 3d530b7.
import { cn } from './cn.ts';

export interface Hint {
  keys: string[];
  label: string;
}

export function HintBar({
  hints,
  className,
  keyClassName,
}: {
  hints: Hint[];
  className?: string;
  keyClassName?: string;
}) {
  return (
    <div className={cn('flex items-center gap-5', className)}>
      {hints.map((hint) => (
        <span key={hint.label} className="flex items-center gap-1.5">
          {hint.keys.map((key) => (
            <kbd key={key} className={keyClassName}>
              {key}
            </kbd>
          ))}
          <span>{hint.label}</span>
        </span>
      ))}
    </div>
  );
}
