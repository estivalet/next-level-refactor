// Ported from NextLevelOS src/themes/components/LevelLogo.tsx @ 3d530b7.
import { CascadingImage } from './CascadingImage.tsx';

/** A menu item's logo art, or its name as text when there is none. */
export function LevelLogo({
  candidates,
  fallbackText,
  className,
}: {
  candidates: string[];
  fallbackText: string;
  className?: string | undefined;
}) {
  return (
    <CascadingImage
      srcs={candidates}
      alt={fallbackText}
      className={className}
      fallback={<span className={className}>{fallbackText}</span>}
    />
  );
}
