import {
  EDITABLE_FIELDS,
  PLAYABILITY_NOTE_MAX,
  type EditableField,
  type GameDetails,
  type PlayabilityMark,
} from '@nextlevel/shared';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changesOf, draftOf, type EditDraft } from './editForm.ts';
import { GameMediaTab } from './GameMediaTab.tsx';
import { useGameDetails, useSetPlayability, useUpdateMetadata } from './libraryApi.ts';
import { INPUT, Modal, PRIMARY_BUTTON, SECONDARY_BUTTON } from './Modal.tsx';
import { PlayabilityPicker } from './PlayabilityPicker.tsx';

interface PlayabilityDraft {
  mark: PlayabilityMark | null;
  note: string;
}

const playabilityOf = (game: GameDetails): PlayabilityDraft => ({
  mark: game.playability?.mark ?? null,
  note: game.playability?.note ?? '',
});

/** Where the edited game sits in the Library list; `onStep` opens the previous or next one. */
export interface EditPager {
  /** 1-based. */
  position: number;
  total: number;
  onStep: (delta: -1 | 1) => void;
}

type EditTab = 'info' | 'media';

/**
 * Edit details (FR-LIB-6) with an Info tab (the fields) and a look-only Media tab. Opens once the
 * game is loaded (normally already cached by the details panel), so the dialog mounts once and
 * focus lands on the first field. Paging keeps the tab and shows the last game until the next
 * one loads.
 */
export function EditMetadataDialog(props: {
  gameId: number;
  pager?: EditPager;
  onClose: () => void;
}) {
  const { gameId, pager, onClose } = props;
  const details = useGameDetails(gameId, { keepPrevious: true });
  const [tab, setTab] = useState<EditTab>('info');
  return details.data ? (
    <EditForm
      game={details.data}
      tab={tab}
      onTab={setTab}
      {...(pager ? { pager } : {})}
      onClose={onClose}
    />
  ) : null;
}

function EditForm(props: {
  game: GameDetails;
  tab: EditTab;
  onTab: (tab: EditTab) => void;
  pager?: EditPager;
  onClose: () => void;
}) {
  const { game, tab, onTab, pager, onClose } = props;
  const { t } = useTranslation();
  const formId = useId();
  const update = useUpdateMetadata();
  const setPlayability = useSetPlayability();
  // The draft belongs to one game: paging to the next starts from its saved values. The dialog
  // stays mounted, so focus stays on ‹ ›.
  const fresh = () => ({
    id: game.id,
    original: draftOf(game),
    draft: draftOf(game),
    playability: playabilityOf(game),
  });
  const [edit, setEdit] = useState(fresh);
  const current = edit.id === game.id ? edit : fresh();
  const { original, draft, playability } = current;
  const setDraft = (next: EditDraft) => {
    setEdit({ ...current, draft: next });
  };
  const setPlayabilityDraft = (next: PlayabilityDraft) => {
    setEdit({ ...current, playability: next });
  };
  const { changes, invalid } = changesOf(original, draft);
  const saved = playabilityOf(game);
  const playabilityChanged =
    playability.mark !== saved.mark ||
    (playability.mark !== null && playability.note.trim() !== saved.note);
  // Paging would drop what was typed: save or cancel first.
  const dirty = changes !== null || playabilityChanged || invalid.size > 0;
  const pending = update.isPending || setPlayability.isPending;
  const save = async () => {
    if (playabilityChanged) {
      await setPlayability.mutateAsync({
        gameIds: [game.id],
        change:
          playability.mark === null
            ? { mark: null }
            : { mark: playability.mark, note: playability.note.trim() },
      });
    }
    if (changes) await update.mutateAsync({ gameId: game.id, changes });
    onClose();
  };
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
      wide
      onClose={onClose}
      footer={
        <>
          <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
            {t('library.edit.cancel')}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={(!changes && !playabilityChanged) || invalid.size > 0 || pending}
            onClick={() => {
              // A failure shows through the mutation state; the dialog stays open.
              save().catch(() => undefined);
            }}
          >
            {t('library.edit.save')}
          </button>
        </>
      }
    >
      <p className="mb-2 truncate text-sm font-semibold text-white">{game.title}</p>
      <div className="mb-3 flex items-center gap-4 border-b border-white/5">
        <div role="tablist" className="flex flex-1 gap-4">
          {(['info', 'media'] as const).map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              id={`${formId}-tab-${name}`}
              aria-selected={tab === name}
              aria-controls={`${formId}-panel`}
              onClick={() => {
                onTab(name);
              }}
              className={`-mb-px border-b-2 px-1 pb-2 text-xs ${
                tab === name
                  ? 'border-emerald-400 text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {t(`library.edit.tabs.${name}`)}
            </button>
          ))}
        </div>
        {pager && (
          <div className="flex items-center gap-2 pb-2 text-[11px] text-slate-500">
            <button
              type="button"
              aria-label={t('library.edit.previous')}
              title={dirty ? t('library.edit.saveFirst') : undefined}
              disabled={dirty || pager.position <= 1}
              onClick={() => {
                pager.onStep(-1);
              }}
              className={PAGER}
            >
              <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
            <span>
              {t('library.edit.position', { position: pager.position, total: pager.total })}
            </span>
            <button
              type="button"
              aria-label={t('library.edit.next')}
              title={dirty ? t('library.edit.saveFirst') : undefined}
              disabled={dirty || pager.position >= pager.total}
              onClick={() => {
                pager.onStep(1);
              }}
              className={PAGER}
            >
              <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      <div id={`${formId}-panel`} role="tabpanel" aria-labelledby={`${formId}-tab-${tab}`}>
        {tab === 'info' ? (
          <div className="grid grid-cols-2 gap-3">
            {EDITABLE_FIELDS.map(field)}
            <div className="col-span-2 flex flex-col gap-1.5">
              <span className="text-[11px] text-slate-400">{t('library.playability.label')}</span>
              <PlayabilityPicker
                value={playability.mark}
                onChange={(mark) => {
                  setPlayabilityDraft({ ...playability, mark });
                }}
              />
              <input
                type="text"
                aria-label={t('library.playability.note')}
                placeholder={t('library.playability.notePlaceholder')}
                maxLength={PLAYABILITY_NOTE_MAX}
                disabled={playability.mark === null}
                value={playability.mark === null ? '' : playability.note}
                onChange={(event) => {
                  setPlayabilityDraft({ ...playability, note: event.target.value });
                }}
                className={`${INPUT} disabled:opacity-50`}
              />
            </div>
          </div>
        ) : (
          <GameMediaTab game={game} />
        )}
      </div>
    </Modal>
  );
}

const PAGER =
  'rounded-md bg-white/5 p-1 text-slate-300 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30';
