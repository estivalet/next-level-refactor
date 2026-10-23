import type { SmartFilterSummary } from '@nextlevel/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorCode, errorMessageKey } from '../settings/settingsApi.ts';
import { Modal, PRIMARY_BUTTON, SECONDARY_BUTTON } from './Modal.tsx';
import { SmartFilterFields } from './SmartFilterFields.tsx';
import { EMPTY_SMART_FORM, fromQuery, toQuery, type SmartField } from './smartFilterForm.ts';
import {
  useCreateSmartFilter,
  useDeleteSmartFilter,
  useUpdateSmartFilter,
} from './smartFiltersApi.ts';

/** Which smart filter dialog is open over the Library (FR-LIB-9). */
export type SmartFilterDialogState =
  | { kind: 'new' }
  | { kind: 'edit'; filter: SmartFilterSummary }
  | { kind: 'delete'; filter: SmartFilterSummary };

export function SmartFilterDialogs({
  state,
  systems,
  onClose,
  onDeleted,
}: {
  state: SmartFilterDialogState;
  systems: ReadonlyArray<{ id: string; name: string }>;
  onClose: () => void;
  /** After a delete: the filter shown is gone. */
  onDeleted: () => void;
}) {
  if (state.kind === 'delete') {
    return <DeleteSmartFilter filter={state.filter} onClose={onClose} onDeleted={onDeleted} />;
  }
  return (
    <EditSmartFilter
      filter={state.kind === 'edit' ? state.filter : null}
      systems={systems}
      onClose={onClose}
    />
  );
}

/** New or edit: Save stays off, with each edited field's message, until the form is valid. */
function EditSmartFilter({
  filter,
  systems,
  onClose,
}: {
  filter: SmartFilterSummary | null;
  systems: ReadonlyArray<{ id: string; name: string }>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const create = useCreateSmartFilter();
  const update = useUpdateSmartFilter();
  const [form, setForm] = useState(() =>
    filter ? fromQuery(filter.name, filter.query) : EMPTY_SMART_FORM,
  );
  const [touched, setTouched] = useState<ReadonlySet<SmartField>>(new Set());
  const result = toQuery(form);
  const shown = result.ok
    ? {}
    : Object.fromEntries(
        Object.entries(result.errors).filter(([f]) => touched.has(f as SmartField)),
      );
  const mutation = filter ? update : create;
  const taken = errorCode(mutation.error) === 'NAME_TAKEN';
  const save = () => {
    if (!result.ok) return;
    const input = { name: result.name, query: result.query };
    const done = { onSuccess: onClose };
    if (filter) update.mutate({ id: filter.id, ...input }, done);
    else create.mutate(input, done);
  };
  return (
    <Modal
      title={t(filter ? 'library.smart.editTitle' : 'library.smart.newTitle')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
            {t('library.smart.cancel')}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={!result.ok || mutation.isPending}
            onClick={save}
          >
            {t('library.smart.save')}
          </button>
        </>
      }
    >
      <SmartFilterFields
        form={form}
        errors={taken ? { ...shown, name: 'errors.nameTaken' } : shown}
        systems={systems}
        onChange={(patch) => {
          setForm((current) => ({ ...current, ...patch }));
          setTouched((current) => new Set([...current, ...(Object.keys(patch) as SmartField[])]));
        }}
      />
      {mutation.error && !taken && (
        <p role="alert" className="mt-3 text-xs text-red-300">
          {t(errorMessageKey(mutation.error))}
        </p>
      )}
    </Modal>
  );
}

function DeleteSmartFilter({
  filter,
  onClose,
  onDeleted,
}: {
  filter: SmartFilterSummary;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const remove = useDeleteSmartFilter();
  return (
    <Modal
      title={t('library.smart.deleteTitle')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
            {t('library.smart.cancel')}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={remove.isPending}
            onClick={() => {
              remove.mutate(filter.id, {
                onSuccess: () => {
                  onDeleted();
                  onClose();
                },
              });
            }}
          >
            {t('library.smart.delete')}
          </button>
        </>
      }
    >
      <p className="text-xs text-slate-300">
        {t('library.smart.deleteBody', { name: filter.name })}
      </p>
      {filter.menus > 0 && (
        <p className="mt-2 text-xs text-amber-300">
          {t('library.smart.usedIn', { count: filter.menus })}
        </p>
      )}
    </Modal>
  );
}
