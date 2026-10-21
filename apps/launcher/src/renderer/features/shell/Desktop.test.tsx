import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderInShell } from '../../test-utils.tsx';
import { Desktop } from './Desktop.tsx';

function renderDesktop() {
  return renderInShell(<Desktop />);
}

function settingsIcon() {
  return screen.getByRole('button', { name: 'Settings' });
}

describe('Desktop', () => {
  it('FR-SHELL-1: double-clicking a desktop icon opens the app window', async () => {
    const user = userEvent.setup();
    renderDesktop();
    await user.dblClick(settingsIcon());
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });

  it('FR-SHELL-1: Enter on a focused icon opens the app', async () => {
    const user = userEvent.setup();
    renderDesktop();
    settingsIcon().focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });

  it('FR-SHELL-1: a single click only selects the icon', async () => {
    const user = userEvent.setup();
    renderDesktop();
    await user.click(settingsIcon());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('FR-SHELL-3: opening Settings twice keeps one window', async () => {
    const user = userEvent.setup();
    renderDesktop();
    await user.dblClick(settingsIcon());
    settingsIcon().focus();
    await user.keyboard('{Enter}');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });
});
