import type { MenuDocNode } from '@nextlevel/shared';
import { FolderPlus } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { v7 as uuidv7 } from 'uuid';
import { MenuTreeView } from './MenuTreeView.tsx';
import { NodeForm } from './NodeForm.tsx';
import { addReference, nodeStatus } from './nodeStatus.ts';
import { NotInMenu } from './NotInMenu.tsx';
import { findNode, insertNode, updateNode } from './treeOps.ts';
import { useMenuRefs } from './useMenuRefs.ts';

/** The tree on the left; the selected node's form and the Not-in-this-menu list on the right. */
export function MenuEditorBody({
  nodes,
  selectedId,
  onSelect,
  onChange,
  onDelete,
}: {
  nodes: MenuDocNode[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (nodes: MenuDocNode[]) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const refs = useMenuRefs();
  const selected = selectedId === null ? null : findNode(nodes, selectedId);
  const statusOf = useCallback(
    (node: MenuDocNode) => (refs ? statusText(node, nodeStatus(node, refs), t) : null),
    [refs, t],
  );
  const addCategory = () => {
    const node: MenuDocNode = {
      id: uuidv7(),
      type: 'category',
      refId: null,
      name: t('menuEditor.newCategory'),
      displayName: null,
      shortName: null,
      filterTabs: true,
      visible: true,
      children: [],
    };
    const parent = selected?.type === 'category' ? selected : null;
    onChange(
      insertNode(nodes, parent?.id ?? null, (parent ?? { children: nodes }).children.length, node),
    );
    onSelect(node.id);
  };
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex min-h-0 flex-col border-r border-white/5">
        <div className="min-h-0 flex-1">
          <MenuTreeView
            nodes={nodes}
            selectedId={selectedId}
            onSelect={onSelect}
            onChange={onChange}
            onDelete={onDelete}
            statusOf={statusOf}
          />
        </div>
        <button
          type="button"
          onClick={addCategory}
          className="flex items-center gap-1 border-t border-white/5 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
        >
          <FolderPlus aria-hidden="true" className="h-3.5 w-3.5" />
          {t('menuEditor.addCategory')}
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto">
        {selected ? (
          <NodeForm
            key={selected.id}
            node={selected}
            refs={refs}
            onPatch={(patch) => {
              onChange(updateNode(nodes, selected.id, patch));
            }}
          />
        ) : (
          <p className="p-3 text-xs text-slate-500">{t('menuEditor.form.none')}</p>
        )}
        {refs && (
          <NotInMenu
            nodes={nodes}
            refs={refs}
            onAdd={(ref) => {
              const added = addReference(nodes, selectedId, ref, refs);
              onChange(added.nodes);
              onSelect(added.id);
            }}
          />
        )}
      </div>
    </div>
  );
}

function statusText(
  node: MenuDocNode,
  status: ReturnType<typeof nodeStatus>,
  t: (key: string) => string,
): string | null {
  if (status === 'ok') return null;
  if (status === 'missingRef') return t(`menuEditor.status.missing.${node.type}`);
  return t(`menuEditor.status.${status}`);
}
