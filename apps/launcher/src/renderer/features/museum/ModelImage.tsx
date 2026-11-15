import { ImageOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { remoteImageUrl } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';

/** The value once it has stopped changing for `ms`; immediate when `ms` is 0. */
function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (ms === 0) return undefined;
    const timer = setTimeout(() => {
      setSettled(value);
    }, ms);
    return () => {
      clearTimeout(timer);
    };
  }, [value, ms]);
  return ms === 0 ? value : settled;
}

/**
 * A model's picture in a fixed-size box. A missing, unsafe or broken image shows a placeholder in
 * the same box, so the layout never shifts (FR-MUS-2). Main fetches and caches the image and serves
 * it as `nextlevel://remote-image/…` (FR-MUS-4). `settleMs` waits for typing to pause, so an
 * editor field does not request an image per keystroke.
 */
export function ModelImage({
  url: typed,
  name,
  settleMs = 0,
}: {
  url: string | undefined;
  name: string;
  settleMs?: number;
}) {
  const { t } = useTranslation();
  const url = useSettled(typed, settleMs);
  const [failed, setFailed] = useState<string | null>(null);
  const src = url === undefined ? null : remoteImageUrl(url);
  const show = src !== null && failed !== url;
  return (
    <div className="flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded bg-white/5">
      {show ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-contain"
          onError={() => {
            setFailed(url ?? null);
          }}
        />
      ) : (
        <ImageOff
          data-testid="model-image-placeholder"
          role="img"
          aria-label={t('apps.museum.noImage')}
          className="h-6 w-6 text-slate-600"
        />
      )}
    </div>
  );
}
