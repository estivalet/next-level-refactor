// Ported from NextLevelOS src/themes/hyperspin/WheelItem.tsx @ 3d530b7.
import { CascadingImage } from '../components/CascadingImage.tsx';
import { cn } from '../components/cn.ts';

/** A wheel entry: the clear logo, or the label in bold caps when no logo loads. */
export function WheelItem({
  candidates,
  label,
  focused,
}: {
  candidates: string[];
  label: string;
  focused: boolean;
}) {
  return (
    <div className={cn('hs-wheel-item', focused && 'hs-wheel-item--focused')}>
      <CascadingImage
        srcs={candidates}
        alt={label}
        className="hs-wheel-logo"
        fallback={<span className="hs-wheel-text">{label}</span>}
      />
    </div>
  );
}
