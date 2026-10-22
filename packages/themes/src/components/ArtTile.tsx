// Ported from NextLevelOS src/themes/components/ArtTile.tsx @ 3d530b7.
import { CascadingImage } from './CascadingImage.tsx';
import { cn } from './cn.ts';
import { LevelLogo } from './LevelLogo.tsx';

/** Cover image filling the tile with a logo (or label) overlaid at the bottom. */
export function ArtTile({
  imageCandidates,
  logoCandidates,
  label,
  focused,
  className,
  logoClassName,
  fallbackClassName,
}: {
  imageCandidates: string[];
  logoCandidates: string[];
  label: string;
  focused: boolean;
  className?: string;
  logoClassName?: string;
  fallbackClassName?: string;
}) {
  return (
    <div
      data-focused={focused ? 'true' : undefined}
      className={cn('relative overflow-hidden', className)}
    >
      <CascadingImage
        srcs={imageCandidates}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        fallback={<div className={cn('absolute inset-0', fallbackClassName)} />}
      />
      <div className="absolute inset-x-0 bottom-0 flex h-2/5 items-center justify-center p-3">
        <LevelLogo candidates={logoCandidates} fallbackText={label} className={logoClassName} />
      </div>
    </div>
  );
}
