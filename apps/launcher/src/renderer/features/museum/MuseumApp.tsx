import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../menus/ConfirmDialog.tsx';
import { EntryView } from './EntryView.tsx';
import { useSystemInfoList } from './museumApi.ts';
import { SystemList, type SystemFilter } from './SystemList.tsx';

const LIST_ERROR = 'text-sm text-[#ff8a80]';

/** What the right side shows: the Home page or one system's page (FR-MUS-9). */
export type MuseumView = { kind: 'home' } | { kind: 'system'; systemId: string };

const sameView = (a: MuseumView, b: MuseumView) =>
  a.kind === b.kind && (a.kind === 'home' || (b.kind === 'system' && a.systemId === b.systemId));

/**
 * The Systems museum (FR-MUS-2, FR-MUS-9): a left menu with Home and every system, the open page on
 * the right. Leaving a page while its entry has unsaved edits asks before discarding them.
 */
export function MuseumApp() {
  const { t } = useTranslation();
  const list = useSystemInfoList();
  const [filter, setFilter] = useState<SystemFilter>({ text: '', kind: '' });
  const [view, setView] = useState<MuseumView>({ kind: 'home' });
  const [dirty, setDirty] = useState(false);
  // The page the user asked for while the open entry was dirty; set while the dialog shows.
  const [pending, setPending] = useState<MuseumView | null>(null);
  const systems = list.data ?? [];
  const selectedId = view.kind === 'system' ? view.systemId : null;
  const selected = systems.find((system) => system.systemId === selectedId);
  if (list.isError && !list.data) {
    return (
      <p role="alert" className={`p-5 ${LIST_ERROR}`}>
        {t('apps.museum.listError')}
      </p>
    );
  }
  const go = (next: MuseumView) => {
    if (sameView(next, view)) return;
    if (dirty) setPending(next);
    else setView(next);
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
          onSelect={(systemId) => {
            go({ kind: 'system', systemId });
          }}
          onHome={() => {
            go({ kind: 'home' });
          }}
        />
        {selected ? (
          <EntryView key={selected.systemId} system={selected} onDirtyChange={setDirty} />
        ) : (
          // Placeholder until the Home page lands (FR-MUS-9).
          <section className="min-w-0 flex-1 p-5">
            <h2 className="text-lg font-semibold text-slate-100">{t('apps.museum.title')}</h2>
            <p className="mt-1 text-sm text-slate-500">{t('apps.museum.pick')}</p>
          </section>
        )}
      </div>
      {pending !== null && (
        <ConfirmDialog
          title={t('apps.museum.discardTitle')}
          message={t('apps.museum.discardMessage')}
          confirmLabel={t('apps.museum.discardConfirm')}
          onCancel={() => {
            setPending(null);
          }}
          onConfirm={() => {
            setDirty(false);
            setView(pending);
            setPending(null);
          }}
        />
      )}
    </div>
  );
}
