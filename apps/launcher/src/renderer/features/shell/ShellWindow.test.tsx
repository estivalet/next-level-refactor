import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import '../../i18n.ts';
import { ShellProvider, useShell } from './ShellContext.tsx';
import { ShellWindow } from './ShellWindow.tsx';

const SIZE = { width: 600, height: 400 };

function Harness({ appIds }: { appIds: string[] }) {
  const { state, dispatch } = useShell();
  useEffect(() => {
    for (const appId of appIds)
      dispatch({ type: 'open', appId, size: SIZE, singleInstance: false });
  }, [appIds, dispatch]);
  return (
    <>
      <output data-testid="focused">{state.focusedId ?? 'none'}</output>
      {state.windows.map((win) => (
        <ShellWindow key={win.id} win={win} title={`Window ${win.id}`}>
          <p>content of {win.id}</p>
        </ShellWindow>
      ))}
    </>
  );
}

function renderShell(appIds: string[]) {
  return render(
    <ShellProvider initialBounds={{ width: 1200, height: 800 }}>
      <Harness appIds={appIds} />
    </ShellProvider>,
  );
}

describe('ShellWindow', () => {
  it('FR-SHELL-2: the close button is keyboard-activatable', async () => {
    const user = userEvent.setup();
    renderShell(['a']);
    const close = await screen.findByRole('button', { name: 'Close' });
    close.focus();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('FR-SHELL-2: minimize hides the window', async () => {
    const user = userEvent.setup();
    renderShell(['a']);
    await user.click(await screen.findByRole('button', { name: 'Minimize' }));
    expect(screen.queryByRole('dialog', { name: 'Window a-1' })).not.toBeInTheDocument();
  });

  it('FR-SHELL-2: maximize turns into restore', async () => {
    const user = userEvent.setup();
    renderShell(['a']);
    await user.click(await screen.findByRole('button', { name: 'Maximize' }));
    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument();
  });

  it('FR-SHELL-2: pointer down on a window focuses it', async () => {
    const user = userEvent.setup();
    renderShell(['a', 'b']);
    expect(await screen.findByTestId('focused')).toHaveTextContent('b-2');
    await user.pointer({ keys: '[MouseLeft]', target: screen.getByText('content of a-1') });
    expect(screen.getByTestId('focused')).toHaveTextContent('a-1');
  });
});
