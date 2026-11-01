import {
  EXPORT_FIELDS,
  EXPORT_FORMATS,
  type ExportView,
  type GameExportRequest,
  type GameScope,
} from '@nextlevel/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getBridge } from '../../bridge.ts';
import { errorMessageKey, unwrap } from '../settings/settingsApi.ts';
import { fieldState, readChoices, saveChoices, toggleField } from './exportChoices.ts';
import { Modal, PRIMARY_BUTTON, SECONDARY_BUTTON } from './Modal.tsx';

export interface ExportDialogProps {
  scope: GameScope;
  /** The scope's name as shown. */
  title: string;
  /** The list on screen: its tab, sort and narrowing. */
  view: ExportView;
  /** Every game of the scope (hidden ones too) and the games shown; null while counting. */
  counts: { every: number | null; shown: number | null };
  onClose: () => void;
}

const LEGEND = 'mb-1.5 text-[10px] font-medium tracking-wider text-slate-500 uppercase';
const OPTION = 'flex items-center gap-2 rounded px-1 py-1 text-xs text-slate-300';

/**
 * Export a system, collection or smart filter to CSV, JSON or gamelist.xml (FR-LIB-11): every
 * game or only the ones shown, with the fields the user ticks. Format and fields are remembered.
 */
export function ExportDialog({ scope, title, view, counts, onClose }: ExportDialogProps) {
  const { t } = useTranslation();
  const [choices, setChoices] = useState(readChoices);
  const [which, setWhich] = useState<'every' | 'shown'>('every');
  const exporting = useMutation({
    mutationFn: async (request: GameExportRequest) =>
      unwrap(await getBridge().invoke('library.export', request)),
  });
  const update = (next: typeof choices) => {
    setChoices(next);
    saveChoices(next);
  };
  const count = (value: number | null) => (value === null ? '…' : value.toLocaleString());
  const narrowing = [
    t(`library.tabs.${view.tab}`),
    ...(view.filter ? [view.filter] : []),
    ...(view.genre ? [view.genre] : []),
  ].join(' · ');
  const saved = exporting.data?.status === 'saved' ? exporting.data.count : null;

  return (
    <Modal
      title={t('library.export.title', { name: title })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
            {saved === null ? t('library.export.cancel') : t('library.export.done')}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={exporting.isPending}
            onClick={() => {
              exporting.mutate({
                scope,
                view: which === 'shown' ? view : null,
                format: choices.format,
                fields: choices.fields.length > 0 ? choices.fields : ['title'],
                title,
              });
            }}
          >
            {t('library.export.save')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <fieldset>
          <legend className={LEGEND}>{t('library.export.format')}</legend>
          {EXPORT_FORMATS.map((format) => (
            <label key={format} className={OPTION}>
              <input
                type="radio"
                name="export-format"
                checked={choices.format === format}
                onChange={() => {
                  update({ ...choices, format });
                }}
              />
              <span>{t(`library.export.formats.${format}`)}</span>
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend className={LEGEND}>{t('library.export.games')}</legend>
          <label className={OPTION}>
            <input
              type="radio"
              name="export-games"
              checked={which === 'every'}
              onChange={() => {
                setWhich('every');
              }}
            />
            <span>{t('library.export.every', { count: count(counts.every) })}</span>
          </label>
          <label className={OPTION}>
            <input
              type="radio"
              name="export-games"
              checked={which === 'shown'}
              onChange={() => {
                setWhich('shown');
              }}
            />
            <span>
              {t('library.export.shown', { count: count(counts.shown) })}
              <span className="ml-1 text-slate-500">({narrowing})</span>
            </span>
          </label>
        </fieldset>
        <fieldset>
          <legend className={LEGEND}>{t('library.export.fields')}</legend>
          <div className="mb-1 flex gap-2 text-[11px]">
            <button
              type="button"
              className="text-emerald-400 hover:underline"
              onClick={() => {
                update({ ...choices, fields: [...EXPORT_FIELDS] });
              }}
            >
              {t('library.export.all')}
            </button>
            <button
              type="button"
              className="text-emerald-400 hover:underline"
              onClick={() => {
                update({ ...choices, fields: ['title'] });
              }}
            >
              {t('library.export.none')}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-4">
            {EXPORT_FIELDS.map((field) => {
              const state = fieldState(choices.format, field);
              return (
                <label
                  key={field}
                  className={`${OPTION} ${state === 'unsupported' ? 'opacity-40' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={
                      state === 'required' ||
                      (state === 'optional' && choices.fields.includes(field))
                    }
                    disabled={state !== 'optional'}
                    onChange={(event) => {
                      update({
                        ...choices,
                        fields: toggleField(choices.fields, field, event.target.checked),
                      });
                    }}
                  />
                  <span>{t(`library.export.field.${field}`)}</span>
                </label>
              );
            })}
          </div>
          {choices.format === 'gamelistXml' && (
            <p className="mt-2 text-[11px] text-slate-500">{t('library.export.xmlHint')}</p>
          )}
        </fieldset>
        <div aria-live="polite" className="text-xs">
          {saved !== null && (
            <p className="text-emerald-400">{t('library.export.saved', { count: saved })}</p>
          )}
          {exporting.isError && (
            <p className="text-red-400">{t(errorMessageKey(exporting.error))}</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
