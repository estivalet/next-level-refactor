import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { renderInShell } from '../../test-utils.tsx';
import { Desktop } from './Desktop.tsx';
import { useShell } from './ShellContext.tsx';
import { Taskbar } from './Taskbar.tsx';

const desktopIcons = () => within(screen.getByRole('navigation', { name: 'Desktop apps' }));

/** Opens two extra windows of a test app id so focus can move between windows. */
function OpenTwo() {
  const { dispatch } = useShell();
  useEffect(() => {
    for (let i = 0; i < 2; i += 1) {
      dispatch({
        type: 'open',
        appId: 'settings',
        size: { width: 600, height: 400 },
        singleInstance: false,
      });
    }
  }, [dispatch]);
  return null;
}

describe('keyboard focus follows the window manager (NFR-A11Y-1)', () => {
  it('FR-SHELL-1: opening an app with Enter moves focus into its window', async () => {
    const user = userEvent.setup();
    renderInShell(<Desktop taskbar={<Taskbar />} />);
    desktopIcons().getByRole('button', { name: 'Settings' }).focus();
    await user.keyboard('{Enter}');
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('FR-SHELL-2: closing a window with the keyboard moves focus to the next window', async () => {
    const user = userEvent.setup();
    renderInShell(
      <>
        <Desktop taskbar={<Taskbar />} />
        <OpenTwo />
      </>,
    );
    const [first, second] = screen.getAllByRole('dialog');
    if (!first || !second) throw new Error('expected two windows');
    within(second).getByRole('button', { name: 'Close' }).focus();
    await user.keyboard('{Enter}');
    expect(first.contains(document.activeElement)).toBe(true);
  });

  it('FR-SHELL-2: closing the last window moves focus back to the desktop', async () => {
    const user = userEvent.setup();
    renderInShell(<Desktop taskbar={<Taskbar />} />);
    await user.dblClick(desktopIcons().getByRole('button', { name: 'Settings' }));
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }).focus();
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(desktopIcons().getAllByRole('button')[0]);
  });

  it('FR-SHELL-2: tabbing into a covered window brings it to the front', () => {
    renderInShell(
      <>
        <Desktop />
        <OpenTwo />
      </>,
    );
    const [first, second] = screen.getAllByRole('dialog');
    if (!first || !second) throw new Error('expected two windows');
    act(() => {
      within(first).getByRole('button', { name: 'Close' }).focus();
    });
    expect(Number(first.style.zIndex)).toBeGreaterThan(Number(second.style.zIndex));
  });
});
