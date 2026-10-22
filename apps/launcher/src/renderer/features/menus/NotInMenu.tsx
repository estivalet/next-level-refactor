import type { MenuDocNode } from '@nextlevel/shared';
import { Plus } from 'lucide-react';
import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { notInMenu, type MenuRefs, type RefType } from './nodeStatus.ts';

const SECTIONS = [
  ['systems', 'system'],
  ['collections', 'collection'],
  ['smartFilters', 'smartFilter'],
] as const;

/** D8: what could be in this menu but isn't, each with Add. Nothing is ever added on its own. */
export function NotInMenu({
  nodes,
  refs,
  onAdd,
}: {
  nodes: readonly MenuDocNode[];
  refs: MenuRefs;
  onAdd: (ref: { type: RefType; refId: string }) => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const missing = useMemo(() => notInMenu(nodes, refs), [nodes, refs]);
  const empty = SECTIONS.every(([key]) => missing[key].length === 0);
  return (
    <section aria-labelledby={titleId} className="space-y-2 p-3 text-xs">
      <h3 id={titleId} className="font-semibold text-slate-300">
        {t('menuEditor.notInMenu.title')}
      </h3>
      {empty && <p className="text-slate-500">{t('menuEditor.notInMenu.none')}</p>}
      {SECTIONS.map(([key, type]) =>
        missing[key].length === 0 ? null : (
          <div key={key}>
            <h4 className="mb-1 text-[10px] tracking-wider text-slate-500 uppercase">
              {t(`menuEditor.notInMenu.${key}`)}
            </h4>
            <ul className="space-y-0.5">
              {missing[key].map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <span className="flex-1 truncate text-slate-300">{item.name}</span>
                  <button
                    type="button"
                    aria-label={t('menuEditor.notInMenu.add', { name: item.name })}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-emerald-300 hover:bg-emerald-500/15"
                    onClick={() => {
                      onAdd({ type, refId: String(item.id) });
                    }}
                  >
                    <Plus aria-hidden="true" className="h-3 w-3" />
                    {t('menuEditor.notInMenu.addShort')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ),
      )}
    </section>
  );
}
