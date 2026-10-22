import type { MenuDocNode, MenuDocument } from '@nextlevel/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getBridge } from '../../bridge.ts';
import { errorCode, unwrap } from '../settings/settingsApi.ts';
import { MENUS_KEY } from './menusApi.ts';

const UNDO_LIMIT = 50;

type Snapshot = { title: string; nodes: MenuDocNode[] };

interface DraftState {
  /** The menu as main last returned it. */
  saved: MenuDocument | null;
  /** False for the generated menu while nothing is stored (FR-MENU-3). */
  stored: boolean;
  current: Snapshot | null;
  undo: Snapshot[];
  /** Error code of the last load or save. */
  error: string | null;
  conflict: boolean;
  saving: boolean;
}

const EMPTY: DraftState = {
  saved: null,
  stored: false,
  current: null,
  undo: [],
  error: null,
  conflict: false,
  saving: false,
};

async function load(menuId: string | null): Promise<{ doc: MenuDocument; stored: boolean }> {
  const bridge = getBridge();
  if (menuId !== null)
    return { doc: unwrap(await bridge.invoke('menus.get', { id: menuId })), stored: true };
  const doc = unwrap(await bridge.invoke('menus.draft'));
  const list = unwrap(await bridge.invoke('menus.list'));
  return { doc, stored: list.some((menu) => menu.id === doc.id) };
}

/**
 * The menu the editor works on (FR-MENU-1): `menuId` null = the active menu, or the generated one
 * while none is stored. Edits are local until save; each edit is one undo step (50 kept). A save
 * over a newer revision sets `conflict` and keeps the edits.
 */
export function useMenuDraft(menuId: string | null) {
  const client = useQueryClient();
  const [state, setState] = useState<DraftState>(EMPTY);
  const seq = useRef(0);

  const reload = useCallback(() => {
    const token = ++seq.current;
    setState(EMPTY);
    load(menuId).then(
      ({ doc, stored }) => {
        if (token !== seq.current) return;
        setState({ ...EMPTY, saved: doc, stored, current: { title: doc.title, nodes: doc.nodes } });
      },
      (error: unknown) => {
        if (token !== seq.current) return;
        setState({ ...EMPTY, error: errorCode(error) ?? 'INTERNAL' });
      },
    );
  }, [menuId]);
  useEffect(reload, [reload]);

  const edit = useCallback((change: (current: Snapshot) => Snapshot) => {
    setState((s) => {
      if (!s.current) return s;
      const next = change(s.current);
      if (next.nodes === s.current.nodes && next.title === s.current.title) return s;
      return { ...s, current: next, undo: [...s.undo.slice(-(UNDO_LIMIT - 1)), s.current] };
    });
  }, []);
  const apply = useCallback(
    (nodes: MenuDocNode[]) => {
      edit((current) => ({ ...current, nodes }));
    },
    [edit],
  );
  const setTitle = useCallback(
    (title: string) => {
      edit((current) => ({ ...current, title }));
    },
    [edit],
  );
  const undo = useCallback(() => {
    setState((s) => {
      const previous = s.undo.at(-1);
      return previous ? { ...s, current: previous, undo: s.undo.slice(0, -1) } : s;
    });
  }, []);

  const save = useCallback(async (): Promise<MenuDocument | null> => {
    const { saved, current, stored } = state;
    if (!saved || !current || state.saving) return null;
    setState((s) => ({ ...s, saving: true, error: null, conflict: false }));
    try {
      const bridge = getBridge();
      const doc = stored
        ? unwrap(
            await bridge.invoke('menus.save', {
              id: saved.id,
              ...current,
              baseRevision: saved.revision,
            }),
          )
        : unwrap(await bridge.invoke('menus.create', current));
      setState({
        ...EMPTY,
        saved: doc,
        stored: true,
        current: { title: doc.title, nodes: doc.nodes },
      });
      void client.invalidateQueries({ queryKey: MENUS_KEY });
      return doc;
    } catch (error) {
      const code = errorCode(error) ?? 'INTERNAL';
      setState((s) => ({ ...s, saving: false, error: code, conflict: code === 'CONFLICT' }));
      return null;
    }
  }, [state, client]);

  const dirty =
    state.saved !== null &&
    state.current !== null &&
    (state.current.nodes !== state.saved.nodes || state.current.title !== state.saved.title);
  return {
    saved: state.saved,
    stored: state.stored,
    title: state.current?.title ?? '',
    nodes: state.current?.nodes ?? null,
    dirty,
    canUndo: state.undo.length > 0,
    error: state.error,
    conflict: state.conflict,
    saving: state.saving,
    apply,
    setTitle,
    undo,
    save,
    reload,
  };
}
