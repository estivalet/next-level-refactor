import { ERROR_CODES, type MenuDocNode } from '@nextlevel/shared';
import { AlertTriangle } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useCloseGuard } from '../shell/closeGuard.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { MenuPicker } from './MenuPicker.tsx';
import { MenuTreeView } from './MenuTreeView.tsx';
import { nodeLabel } from './MenuTreeRow.tsx';
import { useCreateMenu, useDeleteMenu, useMenuList, useSetActiveMenu } from './menusApi.ts';
import { NewMenuDialog, type NewMenuSource } from './NewMenuDialog.tsx';
import { countDescendants, findNode, removeNode } from './treeOps.ts';
import { useMenuDraft } from './useMenuDraft.ts';

const errorKey = (code: string) =>
  code in ERROR_CODES ? ERROR_CODES[code as keyof typeof ERROR_CODES] : 'errors.internal';

type Pending =
  | { kind: 'discard'; then: () => void }
  | { kind: 'deleteNode'; id: string }
  | { kind: 'deleteMenu' }
  | { kind: 'new'; title: string; source: NewMenuSource };

/** The Menu Editor (FR-MENU-1..4, S10): several menus, one active, edited as a tree. */
export function MenuEditorApp() {
  const { t } = useTranslation();
  const [menuId, setMenuId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const list = useMenuList();
  const draft = useMenuDraft(menuId);
  const createMenu = useCreateMenu();
  const deleteMenu = useDeleteMenu();
  const setActive = useSetActiveMenu();
  const nodes = draft.nodes;
  const editingId = draft.saved?.id ?? null;

  /** Runs `then` now, or after the user agrees to drop unsaved changes. */
  const leave = (then: () => void) => {
    if (draft.dirty) setPending({ kind: 'discard', then });
    else then();
  };
  const close = useCloseGuard(() => {
    if (!draft.dirty) return true;
    setPending({
      kind: 'discard',
      then: () => {
        close();
      },
    });
    return false;
  });
  const open = (id: string | null) => {
    setSelectedId(null);
    setPending(null);
    if (id === menuId) draft.reload();
    else setMenuId(id);
  };
  const save = async () => {
    const doc = await draft.save();
    if (doc && doc.id !== menuId) setMenuId(doc.id);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() === 's') void save();
    else if (event.key.toLowerCase() === 'z' && !(event.target instanceof HTMLInputElement))
      draft.undo();
    else return;
    event.preventDefault();
  };

  const confirmPending = () => {
    if (!pending || !nodes) return;
    setPending(null);
    if (pending.kind === 'discard') pending.then();
    else if (pending.kind === 'deleteNode') {
      draft.apply(removeNode(nodes, pending.id));
      setSelectedId(null);
    } else if (pending.kind === 'deleteMenu' && editingId !== null) {
      deleteMenu.mutate(editingId, {
        onSuccess: () => {
          open(null);
        },
      });
    }
  };

  const deleteNodeTitle = (id: string) => {
    const node = nodes && findNode(nodes, id);
    if (!node) return '';
    const count = countDescendants(node);
    return t(
      count > 0 ? 'menuEditor.confirm.deleteNodeWithChildren' : 'menuEditor.confirm.deleteNode',
      {
        name: nodeLabel(node),
        count,
      },
    );
  };

  return (
    <div className="flex h-full flex-col text-slate-200" onKeyDown={onKeyDown}>
      <MenuPicker
        menus={list.data ?? []}
        menuId={editingId}
        unsavedTitle={draft.saved && !draft.stored ? draft.title : null}
        dirty={draft.dirty}
        saving={draft.saving}
        canUndo={draft.canUndo}
        canSave={(draft.dirty || (!draft.stored && draft.saved !== null)) && !draft.saving}
        onPick={(id) => {
          if (id !== editingId)
            leave(() => {
              open(id);
            });
        }}
        onNew={() => {
          leave(() => {
            setPending({ kind: 'new', title: t('menuEditor.new.defaultTitle'), source: 'empty' });
          });
        }}
        onDuplicate={() => {
          const title = t('menuEditor.new.copyTitle', { title: draft.title });
          leave(() => {
            setPending({ kind: 'new', title, source: 'copy' });
          });
        }}
        onDelete={() => {
          setPending({ kind: 'deleteMenu' });
        }}
        onSetActive={() => {
          if (editingId !== null) setActive.mutate(editingId);
        }}
        onUndo={draft.undo}
        onSave={() => void save()}
      />
      {draft.error && (
        <div
          role="alert"
          className="flex items-center gap-2 border-b border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200"
        >
          <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          <span>{t(draft.conflict ? 'menuEditor.conflict' : errorKey(draft.error))}</span>
          {draft.conflict && (
            <button
              type="button"
              className="ml-auto rounded-md border border-red-400/30 px-2 py-0.5 hover:bg-red-500/20"
              onClick={draft.reload}
            >
              {t('menuEditor.reload')}
            </button>
          )}
        </div>
      )}
      {nodes === null ? (
        !draft.error && <p className="p-4 text-xs text-slate-500">{t('menuEditor.loading')}</p>
      ) : (
        <div className="min-h-0 flex-1">
          <MenuTreeView
            nodes={nodes}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={draft.apply}
            onDelete={(id) => {
              setPending({ kind: 'deleteNode', id });
            }}
          />
        </div>
      )}
      {pending?.kind === 'new' && nodes && (
        <NewMenuDialog
          initialTitle={pending.title}
          initialSource={pending.source}
          current={nodes}
          onCancel={() => {
            setPending(null);
          }}
          onCreate={async (input: { title: string; nodes: MenuDocNode[] }) => {
            const created = await createMenu.mutateAsync(input);
            open(created.id);
          }}
        />
      )}
      {pending && pending.kind !== 'new' && (
        <ConfirmDialog
          title={
            pending.kind === 'discard'
              ? t('menuEditor.confirm.discard')
              : pending.kind === 'deleteNode'
                ? deleteNodeTitle(pending.id)
                : t('menuEditor.confirm.deleteMenu', { title: draft.title })
          }
          confirmLabel={t(pending.kind === 'discard' ? 'menuEditor.discard' : 'menuEditor.delete')}
          onCancel={() => {
            setPending(null);
          }}
          onConfirm={confirmPending}
        />
      )}
    </div>
  );
}
