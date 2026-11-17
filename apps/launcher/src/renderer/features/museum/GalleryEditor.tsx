import {
  MUSEUM_GALLERY_MAX,
  museumImageUrl,
  type RejectedImage,
  type SystemGalleryImage,
} from '@nextlevel/shared';
import { ImagePlus } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { INPUT, SECONDARY_BUTTON } from '../library/Modal.tsx';
import { errorMessageKey } from '../settings/settingsApi.ts';
import { useImageAlt } from './GallerySection.tsx';
import { moveItem, removeAt, replaceAt } from './listOps.ts';
import { useAddImages } from './personalApi.ts';
import { RowControls } from './RowControls.tsx';

const CAPTION_MAX = 200;

/**
 * A caption input. Blank or whitespace-only text reads as no caption (`undefined`), since the
 * schema rejects an empty string; the input still shows exactly what was typed.
 */
function CaptionField({
  caption,
  onChange,
}: {
  caption: string | undefined;
  onChange: (caption: string | undefined) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [text, setText] = useState(caption ?? '');
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-slate-400">
        {t('apps.museum.caption')}
      </label>
      <input
        id={id}
        className={INPUT}
        value={text}
        maxLength={CAPTION_MAX}
        onChange={(event) => {
          const value = event.target.value;
          setText(value);
          onChange(value.trim() === '' ? undefined : value);
        }}
      />
    </div>
  );
}

/**
 * The gallery in edit mode (FR-MUS-8): Add images asks main to pick and copy files in, appended in
 * pick order up to `MUSEUM_GALLERY_MAX`; files main turned down are listed with the reason. Each
 * row has a caption and RowControls. Images only join the record when the page is saved; Discard
 * has main delete the copies (see EntryView).
 */
export function GalleryEditor({
  systemId,
  gallery,
  onChange,
}: {
  systemId: string;
  gallery: readonly SystemGalleryImage[];
  onChange: (gallery: SystemGalleryImage[]) => void;
}) {
  const { t } = useTranslation();
  const alt = useImageAlt();
  const addImages = useAddImages();
  const [rejected, setRejected] = useState<RejectedImage[]>([]);
  const [overflow, setOverflow] = useState(false);
  // The picker resolves later; append to the gallery as it is then, not as it was on click.
  const latest = useRef({ gallery, onChange });
  useEffect(() => {
    latest.current = { gallery, onChange };
  }, [gallery, onChange]);
  const full = gallery.length >= MUSEUM_GALLERY_MAX;

  const add = () => {
    setRejected([]);
    setOverflow(false);
    addImages.mutate(
      { systemId },
      {
        onSuccess: (result) => {
          const current = latest.current.gallery;
          const room = Math.max(0, MUSEUM_GALLERY_MAX - current.length);
          const kept = result.added.slice(0, room);
          setRejected(result.rejected);
          setOverflow(result.added.length > room);
          if (kept.length > 0) latest.current.onChange([...current, ...kept]);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {gallery.length === 0 ? (
        <p className="text-xs text-slate-500">{t('apps.museum.galleryEmpty')}</p>
      ) : (
        <ul aria-label={t('apps.museum.sections.gallery')} className="flex flex-col gap-2">
          {gallery.map((image, index) => (
            <li
              key={image.file}
              className="flex items-start gap-2 rounded-lg border border-white/10 p-2"
            >
              <img
                src={museumImageUrl(systemId, image.file)}
                alt={alt(image, index)}
                className="h-16 w-20 shrink-0 rounded object-cover"
              />
              <div className="min-w-0 flex-1">
                <CaptionField
                  caption={image.caption}
                  onChange={(caption) => {
                    onChange(replaceAt(gallery, index, { ...image, caption }));
                  }}
                />
              </div>
              <RowControls
                index={index}
                count={gallery.length}
                onMove={(delta) => {
                  onChange(moveItem(gallery, index, delta));
                }}
                onRemove={() => {
                  onChange(removeAt(gallery, index));
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className={`${SECONDARY_BUTTON} flex w-fit items-center gap-1 disabled:cursor-not-allowed disabled:opacity-40`}
        disabled={full || addImages.isPending}
        onClick={add}
      >
        <ImagePlus aria-hidden="true" className="h-3.5 w-3.5" />
        {t('apps.museum.addImages')}
      </button>
      {(full || overflow) && (
        <p className="text-xs text-amber-300">{t('apps.museum.galleryFull')}</p>
      )}
      {addImages.error && (
        <p role="alert" className="text-xs text-[#ff8a80]">
          {t(errorMessageKey(addImages.error))}
        </p>
      )}
      {rejected.length > 0 && (
        <ul aria-label={t('apps.museum.imagesRejected')} className="text-xs text-[#ff8a80]">
          {rejected.map((item, index) => (
            <li key={`${item.name}-${String(index)}`}>
              {t(`apps.museum.imageRejected.${item.reason}`, { name: item.name })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
