import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntryView } from './EntryView.tsx';
import { useSystemInfoList } from './museumApi.ts';
import { SystemList, type SystemFilter } from './SystemList.tsx';

/** The Systems museum (FR-MUS-2): every system on the left, its entry on the right. */
export function MuseumApp() {
  const { t } = useTranslation();
  const list = useSystemInfoList();
  const [filter, setFilter] = useState<SystemFilter>({ text: '', kind: '' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const systems = list.data ?? [];
  const selected = systems.find((system) => system.systemId === selectedId);
  if (list.isError) {
    return (
      <p role="alert" className="p-5 text-sm text-[#ff8a80]">
        {t('apps.museum.listError')}
      </p>
    );
  }
  return (
    <div className="relative flex h-full text-slate-200">
      <SystemList
        systems={systems}
        filter={filter}
        onFilter={setFilter}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      {selected ? (
        <EntryView key={selected.systemId} system={selected} />
      ) : (
        <p className="p-5 text-sm text-slate-500">{t('apps.museum.pick')}</p>
      )}
    </div>
  );
}
