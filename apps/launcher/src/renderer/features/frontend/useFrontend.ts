import { createContext, useContext } from 'react';

/**
 * Front-end mode (IA §1): the fullscreen theme layer over the shell. Once opened it stays mounted
 * while hidden, so the desktop and back keeps the same level and focus.
 */
export interface FrontendState {
  mounted: boolean;
  visible: boolean;
}

export type FrontendAction = { type: 'show' } | { type: 'hide' };

export const FRONTEND_CLOSED: FrontendState = { mounted: false, visible: false };

export function frontendReducer(state: FrontendState, action: FrontendAction): FrontendState {
  if (action.type === 'show') return state.visible ? state : { mounted: true, visible: true };
  return state.visible ? { ...state, visible: false } : state;
}

export interface FrontendControls extends FrontendState {
  show: () => void;
  hide: () => void;
}

export const FrontendContext = createContext<FrontendControls | null>(null);

export function useFrontend(): FrontendControls {
  const value = useContext(FrontendContext);
  if (!value) throw new Error('useFrontend must be used inside ShellProvider');
  return value;
}
