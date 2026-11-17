import type { SystemInfo, SystemInfoSummary } from '@nextlevel/shared';
import { useCallback, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../library/Modal.tsx';
import { ConfirmDialog } from '../menus/ConfirmDialog.tsx';
import { errorMessageKey } from '../settings/settingsApi.ts';
import { ActionBar } from './ActionBar.tsx';
import { EntryForm } from './EntryForm.tsx';
import { EntrySections } from './EntrySections.tsx';
import { useResetSystemInfo, useSaveSystemInfo, useSystemInfo } from './museumApi.ts';
import { SystemHero } from './SystemHero.tsx';
import { systemDetail } from './SystemList.tsx';

type Confirming = 'discard' | 'reset' | null;

/**
 * A system's museum page (FR-MUS-2, FR-MUS-9): the hero, the entry in a scrolling region, and in
 * edit mode a pinned action bar below that region. `onDirtyChange` reports unsaved edits so the app
 * can ask before leaving the page.
 */
export function EntryView({
  system,
  onDirtyChange,
}: {
  system: SystemInfoSummary;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const query = useSystemInfo(system.systemId);
  const save = useSaveSystemInfo();
  const reset = useResetSystemInfo();
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const data = query.data;
  const entry = data?.entry;
  const failure = save.error ?? reset.error;
  const reportDirty = useCallback(
    (value: boolean) => {
      setDirty(value);
      onDirtyChange?.(value);
    },
    [onDirtyChange],
  );
  const close = () => {
    setConfirming(null);
    setEditing(false);
  };
  const submit = (next: SystemInfo) => {
    save.mutate({ systemId: system.systemId, entry: next }, { onSuccess: close });
  };
  const edit = (
    <button
      type="button"
      className={SECONDARY_BUTTON}
      onClick={() => {
        save.reset();
        reset.reset();
        setEditing(true);
      }}
    >
      {t('apps.museum.edit')}
    </button>
  );
  return (
    <article className="flex min-w-0 flex-1 flex-col" aria-label={system.name}>
      <SystemHero
        name={system.name}
        subtitle={systemDetail(system)}
        action={entry && !editing ? edit : undefined}
      />
      <div data-testid="museum-scroll" className="min-h-0 flex-1 overflow-y-auto p-5">
        {query.isError && <p className="text-xs text-red-400">{t('apps.museum.loadError')}</p>}
        {!entry && !query.isError && (
          <p className="text-xs text-slate-500">{t('apps.museum.loading')}</p>
        )}
        {data && editing && (
          <EntryForm
            formId={formId}
            name={system.name}
            entry={data.entry}
            onSubmit={submit}
            onDirtyChange={reportDirty}
          />
        )}
        {entry && !editing && <EntrySections entry={entry} />}
      </div>
      {data && editing && (
        <ActionBar>
          <button type="submit" form={formId} className={PRIMARY_BUTTON} disabled={save.isPending}>
            {t('apps.museum.save')}
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={() => {
              if (dirty) setConfirming('discard');
              else close();
            }}
          >
            {t('apps.museum.discard')}
          </button>
          {failure && (
            <p role="alert" className="min-w-0 truncate text-xs text-[#ff8a80]">
              {t(errorMessageKey(failure))}
            </p>
          )}
          {data.edited && (
            <button
              type="button"
              className={`${SECONDARY_BUTTON} ml-auto`}
              onClick={() => {
                setConfirming('reset');
              }}
            >
              {t('apps.museum.reset')}
            </button>
          )}
        </ActionBar>
      )}
      {confirming === 'discard' && (
        <ConfirmDialog
          title={t('apps.museum.discardTitle')}
          message={t('apps.museum.discardMessage')}
          confirmLabel={t('apps.museum.discardConfirm')}
          onCancel={() => {
            setConfirming(null);
          }}
          onConfirm={close}
        />
      )}
      {confirming === 'reset' && (
        <ConfirmDialog
          title={t('apps.museum.resetTitle')}
          message={t('apps.museum.resetMessage')}
          confirmLabel={t('apps.museum.reset')}
          onCancel={() => {
            setConfirming(null);
          }}
          onConfirm={() => {
            setConfirming(null);
            reset.mutate({ systemId: system.systemId }, { onSuccess: close });
          }}
        />
      )}
    </article>
  );
}
