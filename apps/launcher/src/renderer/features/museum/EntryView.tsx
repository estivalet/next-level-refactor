import type { SystemInfo, SystemInfoSummary } from '@nextlevel/shared';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../library/Modal.tsx';
import { ConfirmDialog } from '../menus/ConfirmDialog.tsx';
import { errorMessageKey } from '../settings/settingsApi.ts';
import { ActionBar } from './ActionBar.tsx';
import { EntryForm, type DraftChanges, type DraftDirty } from './EntryForm.tsx';
import { EntrySections } from './EntrySections.tsx';
import { useResetSystemInfo, useSaveSystemInfo, useSystemInfo } from './museumApi.ts';
import { cleanupImages, useSavePersonal, useSystemPersonal } from './personalApi.ts';
import { SystemHero } from './SystemHero.tsx';
import { systemDetail } from './SystemList.tsx';

type Confirming = 'discard' | 'reset' | null;

const CLEAN: DraftDirty = { entry: false, personal: false };

/**
 * A system's museum page (FR-MUS-2, FR-MUS-6, FR-MUS-9): the hero, the page in a scrolling region,
 * and in edit mode a pinned action bar below that region. `onDirtyChange` reports unsaved edits so
 * the app can ask before leaving the page. Discarding a changed personal record, or an edit in
 * which images were added (here, or by leaving the page), asks main to delete the images it added
 * (FR-MUS-8). Reset restores only the entry: with unsaved notes or images the form stays open with
 * the shipped entry and the personal draft kept (FR-MUS-6).
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
  const { systemId } = system;
  const query = useSystemInfo(systemId);
  const personalQuery = useSystemPersonal(systemId);
  const save = useSaveSystemInfo();
  const savePersonal = useSavePersonal();
  const reset = useResetSystemInfo();
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState<DraftDirty>(CLEAN);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [resetEntry, setResetEntry] = useState<SystemInfo | undefined>(undefined);
  // Read on unmount: leaving the page with a changed personal draft discards it.
  const personalDirty = useRef(false);
  // Images copied in during this edit; they need a cleanup even if the draft no longer lists them.
  const imagesAdded = useRef(false);
  const needsCleanup = () => personalDirty.current || imagesAdded.current;
  const onImagesAdded = useCallback(() => {
    imagesAdded.current = true;
  }, []);
  const data = query.data;
  const personal = personalQuery.data;
  const entry = data?.entry;
  // A personal record that failed to load does not hide the entry: notes and gallery show an
  // error and only the entry can be edited (FR-MUS-6, FR-MUS-8).
  const personalSettled = personal !== undefined || personalQuery.isError;
  const ready = data !== undefined && personalSettled;
  const loadFailed = query.isError;
  const failure = save.error ?? savePersonal.error ?? reset.error;
  const reportDirty = useCallback(
    (value: DraftDirty) => {
      personalDirty.current = value.personal;
      setDirty(value);
      onDirtyChange?.(value.entry || value.personal);
    },
    [onDirtyChange],
  );
  const latestOnDirtyChange = useRef(onDirtyChange);
  useEffect(() => {
    latestOnDirtyChange.current = onDirtyChange;
  }, [onDirtyChange]);
  // Leaving the page (switching system, going Home) drops the draft: clean up as Discard would.
  useEffect(
    () => () => {
      if (personalDirty.current || imagesAdded.current) void cleanupImages(systemId);
      latestOnDirtyChange.current?.(false);
    },
    [systemId],
  );
  const close = () => {
    reportDirty(CLEAN);
    imagesAdded.current = false;
    setResetEntry(undefined);
    setConfirming(null);
    setEditing(false);
  };
  const discard = () => {
    if (needsCleanup()) void cleanupImages(systemId);
    close();
  };
  const submit = async (changes: DraftChanges) => {
    try {
      if (changes.entry) await save.mutateAsync({ systemId, entry: changes.entry });
      if (changes.personal)
        await savePersonal.mutateAsync({ systemId, personal: changes.personal });
    } catch {
      return; // The mutation's error shows in the action bar.
    }
    // A personal save prunes in main; without one, images added and removed again are orphans.
    if (imagesAdded.current && !changes.personal) void cleanupImages(systemId);
    close();
  };
  const edit = (
    <button
      type="button"
      className={SECONDARY_BUTTON}
      onClick={() => {
        save.reset();
        savePersonal.reset();
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
        action={ready && !editing ? edit : undefined}
      />
      <div data-testid="museum-scroll" className="min-h-0 flex-1 overflow-y-auto p-5">
        {loadFailed && <p className="text-xs text-red-400">{t('apps.museum.loadError')}</p>}
        {!ready && !loadFailed && (
          <p className="text-xs text-slate-500">{t('apps.museum.loading')}</p>
        )}
        {ready && editing && (
          <EntryForm
            formId={formId}
            name={system.name}
            entry={data.entry}
            personal={personal}
            onSubmit={(changes) => void submit(changes)}
            onDirtyChange={reportDirty}
            onImagesAdded={onImagesAdded}
            resetEntryTo={resetEntry}
          />
        )}
        {entry && personalSettled && !editing && (
          <EntrySections entry={entry} personal={personal} />
        )}
      </div>
      {ready && editing && (
        <ActionBar>
          <button
            type="submit"
            form={formId}
            className={PRIMARY_BUTTON}
            disabled={save.isPending || savePersonal.isPending}
          >
            {t('apps.museum.save')}
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={() => {
              if (dirty.entry || dirty.personal) setConfirming('discard');
              else discard();
            }}
          >
            {t('apps.museum.discard')}
          </button>
          {failure && (
            <p role="alert" className="min-w-0 flex-1 text-xs break-words text-[#ff8a80]">
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
          onConfirm={discard}
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
            reset.mutate(
              { systemId },
              {
                onSuccess: (shipped) => {
                  // Unsaved notes and images are kept, as the dialog says: only the entry resets.
                  if (personalDirty.current) setResetEntry(shipped);
                  else discard();
                },
              },
            );
          }}
        />
      )}
    </article>
  );
}
