import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary.tsx';

let throwing = true;
function Child() {
  if (throwing) throw new Error('boom');
  return <p>child works</p>;
}

function fallback(error: Error, reset: () => void) {
  return (
    <button type="button" onClick={reset}>
      {`reset after ${error.message}`}
    </button>
  );
}

// React logs caught render errors to console.error; keep the test output readable.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  throwing = true;
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorBoundary (NFR-REL-2)', () => {
  it('NFR-REL-2: a child that throws shows the fallback and is reported; reset renders the child again', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary fallback={fallback} onError={onError}>
        <Child />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }));
    throwing = false;
    fireEvent.click(screen.getByRole('button', { name: 'reset after boom' }));
    expect(screen.getByText('child works')).toBeInTheDocument();
  });

  it('NFR-REL-2: a new resetKey clears the error', () => {
    const { rerender } = render(
      <ErrorBoundary fallback={fallback} resetKey="a">
        <Child />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('button', { name: 'reset after boom' })).toBeInTheDocument();
    throwing = false;
    rerender(
      <ErrorBoundary fallback={fallback} resetKey="b">
        <Child />
      </ErrorBoundary>,
    );
    expect(screen.getByText('child works')).toBeInTheDocument();
  });
});
