import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error) => void;
  /** A new key clears a caught error (e.g. another theme, or Restart theme). */
  resetKey?: string;
}

interface State {
  error: Error | null;
  key: string | undefined;
}

/**
 * Catches a render crash below it and shows `fallback` instead (NFR-REL-2), so one theme or one
 * desktop window that breaks never takes the rest of the launcher down with it.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey === state.key ? null : { error: null, key: props.resetKey };
  }

  override componentDidCatch(error: unknown): void {
    this.props.onError?.(error instanceof Error ? error : new Error(String(error)));
  }

  private readonly reset = () => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    return this.state.error
      ? this.props.fallback(this.state.error, this.reset)
      : this.props.children;
  }
}
