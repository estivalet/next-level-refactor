import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../menus/ConfirmDialog.tsx';
import { EntryView } from './EntryView.tsx';
import { useSystemInfoList } from './museumApi.ts';
import { SystemList, type SystemFilter } from './SystemList.tsx';

const LIST_ERROR = 'text-sm text-[#ff8a80]';

/**
 * The Systems museum (FR-MUS-2): every system on the left, its entry on the right. Picking another
 * system while the open entry has unsaved edits asks before discarding them.
 */
export function MuseumApp() {
  const { t } = useTranslation();
  const list = useSystemInfoList();
  const [filter, setFilter] = useState<SystemFilter>({ text: '', kind: '' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  // The system the user picked while the open entry was dirty; set while the dialog shows.
  const [pendingId, setPendingId] = useState<string | null>(null);
  const systems = list.data ?? [];
  const selected = systems.find((system) => system.systemId === selectedId);
  if (list.isError && !list.data) {
    return (
      <p role="alert" className={`p-5 ${LIST_ERROR}`}>
        {t('apps.museum.listError')}
      </p>
    );
  }
  const select = (systemId: string) => {
    if (systemId === selectedId) return;
    if (dirty) setPendingId(systemId);
    else setSelectedId(systemId);
  };
  return (
    <div className="relative flex h-full flex-col text-slate-200">
      {list.isError && (
        <p role="alert" className={`border-b border-white/10 px-5 py-2 ${LIST_ERROR}`}>
          {t('apps.museum.listError')}
        </p>
      )}
      <div className="flex min-h-0 flex-1">
        <SystemList
          systems={systems}
          filter={filter}
          onFilter={setFilter}
          selectedId={selectedId}
          onSelect={select}
        />
        {selected ? (
          <EntryView key={selected.systemId} system={selected} onDirtyChange={setDirty} />
        ) : (
          <p className="p-5 text-sm text-slate-500">{t('apps.museum.pick')}</p>
        )}
      </div>
      {pendingId !== null && (
        <ConfirmDialog
          title={t('apps.museum.discardTitle')}
          message={t('apps.museum.discardMessage')}
          confirmLabel={t('apps.museum.discardConfirm')}
          onCancel={() => {
            setPendingId(null);
          }}
          onConfirm={() => {
            setDirty(false);
            setSelectedId(pendingId);
            setPendingId(null);
          }}
        />
      )}
    </div>
  );
}
