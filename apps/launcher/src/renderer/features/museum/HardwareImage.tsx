import { artUrl } from '@nextlevel/shared';
import { hardwarePaths } from '@nextlevel/themes';
import { useState } from 'react';

export type HardwareImageSize = 'thumb' | 'card' | 'hero';

const BOX: Record<HardwareImageSize, string> = {
  thumb: 'h-8 w-11 rounded',
  card: 'h-24 w-32 rounded-lg',
  hero: 'h-40 w-64 rounded-xl',
};
const INITIAL: Record<HardwareImageSize, string> = {
  thumb: 'text-sm',
  card: 'text-3xl',
  hero: 'text-5xl',
};

/**
 * A system's hardware picture from the shared art folder, in a fixed-size box (FR-MUS-8). A missing
 * or broken image shows the system's initial in the same box, so the layout never shifts. It is
 * decorative: the system's name is always shown next to it.
 */
export function HardwareImage({ name, size }: { name: string; size: HardwareImageSize }) {
  const [failed, setFailed] = useState<string | null>(null);
  const rel = hardwarePaths(name)[0];
  const show = name !== '' && rel !== undefined && failed !== name;
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden bg-white/5 ${BOX[size]}`}
    >
      {show ? (
        <img
          src={artUrl({ kind: 'assets' }, rel)}
          alt=""
          loading={size === 'hero' ? undefined : 'lazy'}
          className="h-full w-full object-contain"
          onError={() => {
            setFailed(name);
          }}
        />
      ) : (
        <span
          data-testid="hardware-placeholder"
          aria-hidden="true"
          className={`font-semibold text-slate-500 ${INITIAL[size]}`}
        >
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}
