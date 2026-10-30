import type { MenuDraft } from '@nextlevel/shared';
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
  initialActions,
}: {
  children: ReactNode;
  initialBounds: Bounds;
  /** Whether the launcher boots into the front-end (FR-THM-5). */
  initialFrontend?: FrontendState;
  /** Windows to open as the shell starts (the Catalog after the wizard, FR-ONB-2). */
  initialActions?: readonly WindowAction[];
}) {
  const [state, dispatch] = useReducer(windowReducer, initialBounds, (bounds) =>
    (initialActions ?? []).reduce(windowReducer, initialWindowState(bounds)),
  );
  const [frontend, frontendDispatch] = useReducer(frontendReducer, initialFrontend);
  // Stable show/hide, so effects and memoized children don't rerun on every change.
  const actions = useMemo(
    () => ({
      show: (options?: { previewDraft?: MenuDraft }) => {
        frontendDispatch(
          options?.previewDraft
            ? { type: 'show', previewDraft: options.previewDraft }
            : { type: 'show' },
        );
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
