import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';
import {
  initialWindowState,
  windowReducer,
  type Bounds,
  type WindowAction,
  type WindowState,
} from './windowManager.ts';

interface ShellContextValue {
  state: WindowState;
  dispatch: Dispatch<WindowAction>;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({
  children,
  initialBounds,
}: {
  children: ReactNode;
  initialBounds: Bounds;
}) {
  const [state, dispatch] = useReducer(windowReducer, initialBounds, initialWindowState);
  return <ShellContext value={{ state, dispatch }}>{children}</ShellContext>;
}

export function useShell(): ShellContextValue {
  const value = useContext(ShellContext);
  if (!value) throw new Error('useShell must be used inside ShellProvider');
  return value;
}
