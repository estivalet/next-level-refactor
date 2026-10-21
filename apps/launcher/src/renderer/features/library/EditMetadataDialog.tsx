import { EDITABLE_FIELDS, type EditableField, type GameDetails } from '@nextlevel/shared';
import { Lock } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changesOf, draftOf, type EditDraft } from './editForm.ts';
import { useGameDetails, useUpdateMetadata } from './libraryApi.ts';
import { INPUT, Modal, PRIMARY_BUTTON, SECONDARY_BUTTON } from './Modal.tsx';

/**
 * Edit details (FR-LIB-6). Opens once the game is loaded (normally already cached by the details
 * panel), so the dialog mounts once and focus lands on the first field.
 */
export function EditMetadataDialog({ gameId, onClose }: { gameId: number; onClose: () => void }) {
  const details = useGameDetails(gameId);
  return details.data ? <EditForm game={details.data} onClose={onClose} /> : null;
}

function EditForm({ game, onClose }: { game: GameDetails; onClose: () => void }) {
  const { t } = useTranslation();
  const formId = useId();
  const update = useUpdateMetadata();
  const [original] = useState(() => draftOf(game));
  const [draft, setDraft] = useState<EditDraft>(original);
  const { changes, invalid } = changesOf(original, draft);
  const locked = new Set(game.lockedFields);

  const field = (name: EditableField) => {
    const id = `${formId}-${name}`;
    const hints = [
      ...(invalid.has(name) ? [`${id}-error`] : []),
      ...(locked.has(name) ? [`${id}-locked`] : []),
    ];
    const common = {
      id,
      value: draft[name],
      'aria-invalid': invalid.has(name),
      'aria-describedby': hints.length > 0 ? hints.join(' ') : undefined,
      className: INPUT,
      onChange: (event: { target: { value: string } }) => {
        setDraft({ ...draft, [name]: event.target.value });
      },
    };
    return (
      <div key={name} className={name === 'description' ? 'col-span-2' : ''}>
        <label htmlFor={id} className="mb-1 flex items-center gap-1 text-[11px] text-slate-400">
          {t(`library.fields.${name}`)}
          {locked.has(name) && <Lock aria-hidden="true" className="h-3 w-3 text-emerald-400" />}
        </label>
        {name === 'description' ? (
          <textarea rows={5} {...common} />
        ) : (
          <input type="text" inputMode={name === 'year' ? 'numeric' : undefined} {...common} />
        )}
        {invalid.has(name) && (
          <p id={`${id}-error`} className="mt-1 text-[11px] text-red-300">
            {t('library.edit.invalid')}
          </p>
        )}
        {locked.has(name) && (
          <p id={`${id}-locked`} className="sr-only">
            {t('library.edit.locked')}
          </p>
        )}
        {name === 'filters' && (
          <p className="mt-1 text-[10px] text-slate-600">{t('library.edit.filtersHint')}</p>
        )}
      </div>
    );
  };

  return (
    <Modal
      title={t('library.edit.title')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
            {t('library.edit.cancel')}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={!changes || update.isPending}
            onClick={() => {
              if (!changes) return;
              update.mutate({ gameId: game.id, changes }, { onSuccess: onClose });
            }}
          >
            {t('library.edit.save')}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">{EDITABLE_FIELDS.map(field)}</div>
    </Modal>
  );
}
