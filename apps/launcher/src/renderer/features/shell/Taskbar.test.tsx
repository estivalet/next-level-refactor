import type { NextLevelBridge } from '@nextlevel/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { renderInShell } from '../../test-utils.tsx';
import { Desktop } from './Desktop.tsx';
import { Taskbar } from './Taskbar.tsx';
import { TrayClock } from './TrayClock.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

function renderShell() {
  return renderInShell(<Desktop taskbar={<Taskbar />} />);
}

const taskbar = () => within(screen.getByRole('navigation', { name: 'Taskbar' }));
const desktopIcons = () => within(screen.getByRole('navigation', { name: 'Desktop apps' }));

describe('Taskbar', () => {
  it('FR-SHELL-4: a taskbar entry minimizes the focused window and restores it', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.dblClick(desktopIcons().getByRole('button', { name: 'Settings' }));
    const entry = taskbar().getByRole('button', { name: 'Settings' });

    await user.click(entry);
    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument();

    await user.click(entry);
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });

  it('FR-SHELL-5: Start menu filters apps and Esc closes it', async () => {
    const user = userEvent.setup();
    renderShell();
    const start = taskbar().getByRole('button', { name: 'Start' });
    await user.click(start);
    const menu = screen.getByRole('dialog', { name: 'Start menu' });
    expect(within(menu).getByRole('searchbox', { name: 'Search apps' })).toHaveFocus();

    await user.keyboard('xyz');
    expect(within(menu).queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
    expect(within(menu).getByText('No apps match')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Start menu' })).not.toBeInTheDocument();
    expect(start).toHaveFocus();
  });

  it('FR-SHELL-5: a click outside closes the Start menu', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(taskbar().getByRole('button', { name: 'Start' }));
    await user.click(screen.getByRole('main', { name: 'Desktop' }));
    expect(screen.queryByRole('dialog', { name: 'Start menu' })).not.toBeInTheDocument();
  });

  it('FR-SHELL-5: choosing an app from Start opens it and closes the menu', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(taskbar().getByRole('button', { name: 'Start' }));
    const menu = screen.getByRole('dialog', { name: 'Start menu' });
    await user.click(within(menu).getByRole('button', { name: 'Settings' }));
    expect(screen.queryByRole('dialog', { name: 'Start menu' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });

  it('FR-SHELL-5: Quit calls app.quit', async () => {
    const calls: string[] = [];
    const invoke = ((channel: string) => {
      calls.push(channel);
      return Promise.resolve({ ok: true, value: undefined });
    }) as NextLevelBridge['invoke'];
    setBridgeForTests({ invoke });
    const user = userEvent.setup();
    renderShell();
    await user.click(taskbar().getByRole('button', { name: 'Start' }));
    await user.click(screen.getByRole('button', { name: 'Quit' }));
    expect(calls).toEqual(['app.quit']);
  });

  it('FR-SHELL-4: the tray shows the time', () => {
    render(<TrayClock now={() => new Date(2026, 0, 1, 21, 4)} />);
    expect(screen.getByText('21:04')).toBeInTheDocument();
  });
});
