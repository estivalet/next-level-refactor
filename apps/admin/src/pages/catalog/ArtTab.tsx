import { GAME_ART_KINDS, type AdminCatalogItem, type CatalogMediaKind } from '@nextlevel/shared';
import { Button, Table } from '@nextlevel/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRemoveMedia, useUploadMedia } from '../../api/catalog.ts';
import { catalogErrorKey, formatBytes } from './catalogText.ts';
import { Progress, type Sending } from './Progress.tsx';

/** Item art (FR-ADM-3): one image or video per kind; a new upload replaces the old one. */
export function ArtTab({ item }: { item: AdminCatalogItem }) {
  const { t, i18n } = useTranslation();
  const upload = useUploadMedia(item.id);
  const remove = useRemoveMedia(item.id);
  const [sending, setSending] = useState<Sending | null>(null);
  const busy = sending !== null;
  const error = upload.error ?? remove.error;

  const send = (kind: CatalogMediaKind, file: File) => {
    const name = t(`admin.catalog.art.kinds.${kind}`);
    remove.reset();
    setSending({ name, loaded: 0, total: file.size });
    upload.mutate(
      {
        file,
        kind,
        onProgress: (loaded, total) => {
          setSending({ name, loaded, total });
        },
      },
      {
        onSettled: () => {
          setSending(null);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-slate-500">{t('admin.catalog.art.help')}</p>
      <Table
        label={t('admin.catalog.art.title')}
        columns={[t('admin.catalog.art.kind'), t('admin.catalog.art.current'), '']}
        empty=""
        rows={GAME_ART_KINDS.map((kind) => {
          const media = item.media.find((m) => m.kind === kind);
          const name = t(`admin.catalog.art.kinds.${kind}`);
          return {
            key: kind,
            cells: [
              name,
              media
                ? t('admin.catalog.art.stored', {
                    size: formatBytes(media.size, i18n.language),
                    version: media.version,
                  })
                : t('admin.catalog.art.none'),
              <div key="actions" className="flex gap-2 whitespace-nowrap">
                <label className="cursor-pointer rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15">
                  {t('admin.catalog.art.upload')}
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="sr-only"
                    disabled={busy}
                    aria-label={t('admin.catalog.art.uploadLabel', { name })}
                    onChange={(event) => {
                      const picked = event.target.files?.[0];
                      event.target.value = '';
                      if (picked) send(kind, picked);
                    }}
                  />
                </label>
                {media && (
                  <Button
                    aria-label={t('admin.catalog.art.removeLabel', { name })}
                    disabled={remove.isPending || busy}
                    onClick={() => {
                      upload.reset();
                      remove.mutate(kind);
                    }}
                  >
                    {t('admin.catalog.art.remove')}
                  </Button>
                )}
              </div>,
            ],
          };
        })}
      />
      {sending && <Progress sending={sending} />}
      {error && (
        <p role="alert" className="text-sm text-[#ff8a80]">
          {t(catalogErrorKey(error))}
        </p>
      )}
    </div>
  );
}
