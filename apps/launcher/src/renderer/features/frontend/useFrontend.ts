import type { MenuDraft } from '@nextlevel/shared';
import { createContext, useContext } from 'react';

/**
 * Front-end mode (IA §1): the fullscreen theme layer over the shell. Once opened it stays mounted
 * while hidden, so the desktop and back keeps the same level and focus.
 */
export interface FrontendState {
  mounted: boolean;
  visible: boolean;
  /**
   * Menu Editor preview (US-D5): an unsaved menu shown in the current theme, in its own layer
   * above everything; the regular front-end keeps its level and focus underneath.
   */
  preview: MenuDraft | null;
}

export type FrontendAction = { type: 'show'; previewDraft?: MenuDraft } | { type: 'hide' };

export const FRONTEND_CLOSED: FrontendState = { mounted: false, visible: false, preview: null };

export function frontendReducer(state: FrontendState, action: FrontendAction): FrontendState {
  if (action.type === 'show') {
    if (action.previewDraft) return { ...state, preview: action.previewDraft };
    return state.visible ? state : { ...state, mounted: true, visible: true };
  }
  // Leaving a preview returns to whatever was below it.
  if (state.preview) return { ...state, preview: null };
  return state.visible ? { ...state, visible: false } : state;
}

export interface FrontendControls extends FrontendState {
  show: (options?: { previewDraft?: MenuDraft }) => void;
  hide: () => void;
}

export const FrontendContext = createContext<FrontendControls | null>(null);

export function useFrontend(): FrontendControls {
  const value = useContext(FrontendContext);
  if (!value) throw new Error('useFrontend must be used inside ShellProvider');
  return value;
}
