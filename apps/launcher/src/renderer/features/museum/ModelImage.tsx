import { ImageOff } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/** Remote images only: main drops other schemes, so they never reach an <img>. */
export function isSafeImageUrl(url: string | undefined): url is string {
  return url !== undefined && url.startsWith('https://');
}

/**
 * A model's picture in a fixed-size box. A missing, unsafe or broken image shows a placeholder in
 * the same box, so the layout never shifts (FR-MUS-2).
 */
export function ModelImage({ url, name }: { url: string | undefined; name: string }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState<string | null>(null);
  const show = isSafeImageUrl(url) && failed !== url;
  return (
    <div className="flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded bg-white/5">
      {show ? (
        <img
          src={url}
          alt={name}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-contain"
          onError={() => {
            setFailed(url);
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
