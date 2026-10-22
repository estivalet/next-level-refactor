import { MenuTitleSchema, type MenuDocNode } from '@nextlevel/shared';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v7 as uuidv7 } from 'uuid';
import { INPUT, Modal, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../library/Modal.tsx';
import { errorMessageKey } from '../settings/settingsApi.ts';
import { fetchGeneratedMenu } from './menusApi.ts';
import { reIdNodes } from './treeOps.ts';

export type NewMenuSource = 'copy' | 'generated' | 'empty';

const SOURCES: NewMenuSource[] = ['copy', 'generated', 'empty'];

/**
 * New menu (FR-MENU-1/3): a title and where it starts from — a copy of what the editor shows
 * (with new node ids), a menu generated from the enabled systems, or nothing.
 */
export function NewMenuDialog({
  initialTitle,
  initialSource = 'copy',
  current,
  onCreate,
  onCancel,
}: {
  initialTitle: string;
  initialSource?: NewMenuSource;
  current: MenuDocNode[];
  onCreate: (input: { title: string; nodes: MenuDocNode[] }) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initialTitle);
  const [source, setSource] = useState(initialSource);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameId = useId();
  const valid = MenuTitleSchema.safeParse(title).success;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const nodes =
        source === 'copy'
          ? reIdNodes(current, uuidv7)
          : source === 'generated'
            ? (await fetchGeneratedMenu()).nodes
            : [];
      await onCreate({ title: title.trim(), nodes });
    } catch (caught) {
      setError(t(errorMessageKey(caught)));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t('menuEditor.new.title')}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className={SECONDARY_BUTTON} onClick={onCancel}>
            {t('menuEditor.cancel')}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={!valid || busy}
            onClick={() => void submit()}
          >
            {t('menuEditor.new.create')}
          </button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label htmlFor={nameId} className="block text-xs text-slate-400">
          {t('menuEditor.new.name')}
        </label>
        <input
          id={nameId}
          className={INPUT}
          value={title}
          maxLength={100}
          aria-invalid={!valid}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
        <fieldset className="space-y-1 text-xs text-slate-300">
          <legend className="mb-1 text-slate-400">{t('menuEditor.new.startFrom')}</legend>
          {SOURCES.map((value) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="radio"
                name="menu-source"
                checked={source === value}
                onChange={() => {
                  setSource(value);
                }}
              />
              {t(`menuEditor.new.source.${value}`)}
            </label>
          ))}
        </fieldset>
        {error && (
          <p role="alert" className="text-xs text-red-300">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
