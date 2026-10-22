import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import {
  FRONTEND_CLOSED,
  FrontendContext,
  frontendReducer,
  type FrontendControls,
  type FrontendState,
} from '../frontend/useFrontend.ts';
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

/** The desktop's windows and the front-end layer above them. */
export function ShellProvider({
  children,
  initialBounds,
  initialFrontend = FRONTEND_CLOSED,
}: {
  children: ReactNode;
  initialBounds: Bounds;
  /** Whether the launcher boots into the front-end (FR-THM-5). */
  initialFrontend?: FrontendState;
}) {
  const [state, dispatch] = useReducer(windowReducer, initialBounds, initialWindowState);
  const [frontend, frontendDispatch] = useReducer(frontendReducer, initialFrontend);
  // Stable show/hide, so effects and memoized children don't rerun on every change.
  const actions = useMemo(
    () => ({
      show: () => {
        frontendDispatch({ type: 'show' });
      },
      hide: () => {
        frontendDispatch({ type: 'hide' });
      },
    }),
    [],
  );
  const controls = useMemo<FrontendControls>(
    () => ({ ...frontend, ...actions }),
    [frontend, actions],
  );
  return (
    <ShellContext value={{ state, dispatch }}>
      <FrontendContext value={controls}>{children}</FrontendContext>
    </ShellContext>
  );
}

export function useShell(): ShellContextValue {
  const value = useContext(ShellContext);
  if (!value) throw new Error('useShell must be used inside ShellProvider');
  return value;
}
