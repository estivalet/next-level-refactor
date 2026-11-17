import { museumImageUrl, type SystemGalleryImage } from '@nextlevel/shared';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const ICON_BUTTON =
  'rounded-md p-1.5 text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent';

/** An image's accessible name: its caption, or "Image n". */
export function useImageAlt() {
  const { t } = useTranslation();
  return (image: SystemGalleryImage, index: number) =>
    image.caption ?? t('apps.museum.imageAlt', { number: index + 1 });
}

/**
 * One gallery image at a time over the app (FR-MUS-8), after the `Modal` pattern: ←/→ move, Esc
 * closes, the close button takes focus on open and focus returns to the opener on close. A Prev or
 * Next button that disables while focused hands focus to the close button, so keys keep working.
 */
function ImageViewer({
  systemId,
  gallery,
  start,
  onClose,
}: {
  systemId: string;
  gallery: readonly SystemGalleryImage[];
  start: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const alt = useImageAlt();
  const titleId = useId();
  const closeButton = useRef<HTMLButtonElement>(null);
  const prevButton = useRef<HTMLButtonElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const [index, setIndex] = useState(start);
  const image = gallery[index];
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    return () => {
      previous?.focus();
    };
  }, []);
  if (!image) return null;
  const move = (delta: -1 | 1) => {
    const next = Math.min(gallery.length - 1, Math.max(0, index + delta));
    const edge = delta < 0 ? next === 0 : next === gallery.length - 1;
    const button = delta < 0 ? prevButton.current : nextButton.current;
    // A disabled button drops focus to <body>, where the dialog's keys no longer arrive.
    if (edge && button !== null && document.activeElement === button) closeButton.current?.focus();
    setIndex(next);
  };
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-full w-full max-w-4xl flex-col gap-2 rounded-xl border border-white/10 bg-[#1a1a24] p-3 shadow-2xl"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
          else if (event.key === 'ArrowLeft') move(-1);
          else if (event.key === 'ArrowRight') move(1);
          else return;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <div className="flex items-center gap-2">
          <h2 id={titleId} className="flex-1 truncate text-sm text-slate-200">
            {image.caption ?? alt(image, index)}
          </h2>
          <span className="text-xs text-slate-500">
            {t('apps.museum.viewer.position', { index: index + 1, count: gallery.length })}
          </span>
          <button
            ref={closeButton}
            type="button"
            className={ICON_BUTTON}
            aria-label={t('apps.museum.viewer.close')}
            onClick={onClose}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-center gap-2">
          <button
            ref={prevButton}
            type="button"
            className={ICON_BUTTON}
            aria-label={t('apps.museum.viewer.prev')}
            disabled={index === 0}
            onClick={() => {
              move(-1);
            }}
          >
            <ChevronLeft aria-hidden="true" className="h-5 w-5" />
          </button>
          <img
            src={museumImageUrl(systemId, image.file)}
            alt={alt(image, index)}
            className="mx-auto max-h-[70vh] min-w-0 object-contain"
          />
          <button
            ref={nextButton}
            type="button"
            className={ICON_BUTTON}
            aria-label={t('apps.museum.viewer.next')}
            disabled={index === gallery.length - 1}
            onClick={() => {
              move(1);
            }}
          >
            <ChevronRight aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** The owner's images as a thumbnail grid; a thumbnail opens the viewer (FR-MUS-8). */
export function GallerySection({
  title,
  systemId,
  gallery,
}: {
  title: string;
  systemId: string;
  gallery: readonly SystemGalleryImage[];
}) {
  const { t } = useTranslation();
  const alt = useImageAlt();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="mb-6" aria-label={title}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      {gallery.length === 0 ? (
        <p className="text-xs text-slate-500">{t('apps.museum.galleryEmpty')}</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-2">
          {gallery.map((image, index) => (
            <li key={image.file}>
              <button
                type="button"
                className="block aspect-[4/3] w-full overflow-hidden rounded-lg border border-white/10 bg-black/40 hover:border-emerald-500/50"
                onClick={() => {
                  setOpen(index);
                }}
              >
                <img
                  src={museumImageUrl(systemId, image.file)}
                  alt={alt(image, index)}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      {open !== null && (
        <ImageViewer
          systemId={systemId}
          gallery={gallery}
          start={open}
          onClose={() => {
            setOpen(null);
          }}
        />
      )}
    </section>
  );
}
