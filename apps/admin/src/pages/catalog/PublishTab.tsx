import { ON_LAPSE, type AdminCatalogItem } from '@nextlevel/shared';
import { Button } from '@nextlevel/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePublish, useUnpublish, useUpdateItem } from '../../api/catalog.ts';
import { catalogErrorKey } from './catalogText.ts';
import { Confirm } from './Confirm.tsx';

/**
 * Who sees the item and what happens when it leaves (D43, D46), then the publish gate (C10, D44):
 * every blocker is named and Publish stays disabled until there are none.
 */
export function PublishTab({ item }: { item: AdminCatalogItem }) {
  const { t } = useTranslation();
  const update = useUpdateItem(item.id);
  const publish = usePublish(item.id);
  const unpublish = useUnpublish(item.id);
  const [confirming, setConfirming] = useState(false);
  const error = update.error ?? publish.error ?? unpublish.error;
  // Each change starts from a clean slate: an old refusal must not outlive a later success.
  const resetAll = () => {
    update.reset();
    publish.reset();
    unpublish.reset();
  };
  const blocked = item.publishBlockers.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-white">
          {t('admin.catalog.publish.onLapse')}
        </legend>
        <p className="text-xs text-slate-500">{t('admin.catalog.publish.onLapseHelp')}</p>
        {ON_LAPSE.map((choice) => (
          <label key={choice} className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="onLapse"
              className="mt-1"
              checked={item.onLapse === choice}
              disabled={update.isPending}
              onChange={() => {
                resetAll();
                update.mutate({ onLapse: choice });
              }}
            />
            <span>
              <span className="text-slate-100">{t(`admin.catalog.publish.${choice}`)}</span>
              <span className="block text-xs text-slate-500">
                {t(`admin.catalog.publish.${choice}Help`)}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={item.starter}
            disabled={update.isPending}
            aria-describedby="starter-help"
            onChange={(event) => {
              resetAll();
              update.mutate({ starter: event.target.checked });
            }}
          />
          {t('admin.catalog.publish.starter')}
        </label>
        <p id="starter-help" className="text-xs text-slate-500">
          {t('admin.catalog.publish.starterHelp')}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-200">
          {t('admin.catalog.publish.status', { status: t(`admin.catalog.status.${item.status}`) })}
        </p>
        {blocked && (
          <div>
            <p id="publish-blockers" className="text-sm text-slate-400">
              {t('admin.catalog.publish.blockersTitle')}
            </p>
            <ul
              aria-label={t('admin.catalog.publish.blockersTitle')}
              className="mt-1 list-disc pl-5 text-sm text-amber-200"
            >
              {item.publishBlockers.map((blocker) => (
                <li key={blocker}>{t(`admin.catalog.blockers.${blocker}`)}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex gap-2">
          {item.status !== 'published' && (
            <Button
              variant="primary"
              disabled={blocked || publish.isPending}
              aria-describedby={blocked ? 'publish-blockers' : undefined}
              onClick={() => {
                resetAll();
                publish.mutate();
              }}
            >
              {t('admin.catalog.publish.publish')}
            </Button>
          )}
          {item.status === 'published' && (
            <Button
              disabled={unpublish.isPending}
              onClick={() => {
                setConfirming(true);
              }}
            >
              {t('admin.catalog.publish.unpublish')}
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-[#ff8a80]">
          {t(catalogErrorKey(error))}
        </p>
      )}
      {confirming && (
        <Confirm
          title={t('admin.catalog.publish.unpublishTitle', { title: item.title })}
          body={t('admin.catalog.publish.unpublishBody')}
          action={t('admin.catalog.publish.unpublish')}
          onConfirm={() => {
            resetAll();
            unpublish.mutate();
          }}
          onClose={() => {
            setConfirming(false);
          }}
        />
      )}
    </div>
  );
}
