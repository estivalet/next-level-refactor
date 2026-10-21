import { CollectionNameSchema, type CollectionSummary } from '@nextlevel/shared';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorCode } from '../settings/settingsApi.ts';
import { useCreateCollection, useDeleteCollection, useUpdateCollection } from './collectionsApi.ts';
import { AddToCollection } from './AddToCollectionDialog.tsx';
import { INPUT, Modal, PRIMARY_BUTTON, SECONDARY_BUTTON } from './Modal.tsx';

/** Which collection dialog is open over the Library. */
export type CollectionDialogState =
  | { kind: 'new' }
  | { kind: 'rename'; collection: CollectionSummary }
  | { kind: 'delete'; collection: CollectionSummary }
  | { kind: 'add'; gameIds: number[] };

interface CollectionDialogsProps {
  state: CollectionDialogState;
  onClose: () => void;
  /** After a delete: the collection shown is gone. */
  onDeleted: () => void;
}

export function CollectionDialogs({ state, onClose, onDeleted }: CollectionDialogsProps) {
  if (state.kind === 'new') return <NewCollection onClose={onClose} />;
  if (state.kind === 'rename')
    return <RenameCollection collection={state.collection} onClose={onClose} />;
  if (state.kind === 'delete') {
    return (
      <DeleteCollection collection={state.collection} onClose={onClose} onDeleted={onDeleted} />
    );
  }
  return <AddToCollection gameIds={state.gameIds} onClose={onClose} />;
}

/** A name field with the server's NAME_TAKEN shown inline (FR-LIB-8). */
function NameDialog(props: {
  title: string;
  confirm: string;
  initial: string;
  error: unknown;
  pending: boolean;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [name, setName] = useState(props.initial);
  const valid = CollectionNameSchema.safeParse(name).success;
  const taken = errorCode(props.error) === 'NAME_TAKEN';
  const submit = () => {
    if (valid) props.onSubmit(name.trim());
  };
  return (
    <Modal
      title={props.title}
      onClose={props.onClose}
      footer={
        <>
          <button type="button" className={SECONDARY_BUTTON} onClick={props.onClose}>
            {t('library.collections.cancel')}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={!valid || props.pending}
            onClick={submit}
          >
            {props.confirm}
          </button>
        </>
      }
    >
      <label htmlFor={id} className="mb-1 block text-[11px] text-slate-400">
        {t('library.collections.name')}
      </label>
      <input
        id={id}
        type="text"
        value={name}
        maxLength={100}
        aria-invalid={taken}
        aria-describedby={taken ? `${id}-error` : undefined}
        onChange={(event) => {
          setName(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit();
        }}
        className={INPUT}
      />
      {taken && (
        <p id={`${id}-error`} className="mt-1 text-[11px] text-red-300">
          {t('errors.nameTaken')}
        </p>
      )}
    </Modal>
  );
}

function NewCollection({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const create = useCreateCollection();
  return (
    <NameDialog
      title={t('library.collections.newTitle')}
      confirm={t('library.collections.create')}
      initial=""
      error={create.error}
      pending={create.isPending}
      onSubmit={(name) => {
        create.mutate(name, { onSuccess: onClose });
      }}
      onClose={onClose}
    />
  );
}

function RenameCollection({
  collection,
  onClose,
}: {
  collection: CollectionSummary;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const update = useUpdateCollection();
  return (
    <NameDialog
      title={t('library.collections.renameTitle')}
      confirm={t('library.collections.save')}
      initial={collection.name}
      error={update.error}
      pending={update.isPending}
      onSubmit={(name) => {
        update.mutate({ id: collection.id, name }, { onSuccess: onClose });
      }}
      onClose={onClose}
    />
  );
}

function DeleteCollection(props: {
  collection: CollectionSummary;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const remove = useDeleteCollection();
  return (
    <Modal
      title={t('library.collections.deleteTitle', { name: props.collection.name })}
      onClose={props.onClose}
      footer={
        <>
          <button type="button" className={SECONDARY_BUTTON} onClick={props.onClose}>
            {t('library.collections.cancel')}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={remove.isPending}
            onClick={() => {
              remove.mutate(props.collection.id, {
                onSuccess: () => {
                  props.onDeleted();
                  props.onClose();
                },
              });
            }}
          >
            {t('library.collections.delete')}
          </button>
        </>
      }
    >
      <p className="text-xs text-slate-300">{t('library.collections.deleteBody')}</p>
    </Modal>
  );
}
