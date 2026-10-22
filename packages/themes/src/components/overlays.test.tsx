// Cases ported from NextLevelOS src/themes/components/ThemeExitMenu.test.tsx and
// KeyHelpOverlay.test.tsx @ 3d530b7. Both overlays read input actions (keys and gamepad buttons
// from the user's settings), so they work without a keyboard (US-C1).
import { defaultSettings } from '@nextlevel/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { KeyMap } from '../engine/types.ts';
import { KeyHelpOverlay } from './KeyHelpOverlay.tsx';
import { ThemeExitMenu } from './ThemeExitMenu.tsx';

const input = defaultSettings().input;

/** A full key press: input actions fire on keydown, and a key counts again after its keyup. */
function press(target: Element, code: string) {
  fireEvent.keyDown(target, { code });
  fireEvent.keyUp(target, { code });
}

function setupMenu(withSwitch = true) {
  const onDesktop = vi.fn();
  const onSwitchTheme = vi.fn();
  const onClose = vi.fn();
  render(
    <ThemeExitMenu
      input={input}
      onDesktop={onDesktop}
      {...(withSwitch ? { onSwitchTheme } : {})}
      onClose={onClose}
    />,
  );
  const dialog = screen.getByRole('dialog', { name: 'Theme menu' });
  return { onDesktop, onSwitchTheme, onClose, dialog };
}

describe('ThemeExitMenu (FR-THM-3, US-C1)', () => {
  it('takes focus and highlights "Return to desktop" first', () => {
    const { dialog } = setupMenu();
    expect(document.activeElement).toBe(dialog);
    expect(screen.getByRole('button', { name: /Return to desktop/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('select runs the highlighted action', () => {
    const { dialog, onDesktop } = setupMenu();
    press(dialog, 'Enter');
    expect(onDesktop).toHaveBeenCalledTimes(1);
  });

  it('down moves to "Switch theme"; up wraps to "Resume"', () => {
    const { dialog, onSwitchTheme, onClose } = setupMenu();
    press(dialog, 'ArrowDown');
    press(dialog, 'Enter');
    expect(onSwitchTheme).toHaveBeenCalledTimes(1);
    press(dialog, 'ArrowUp');
    press(dialog, 'ArrowUp');
    press(dialog, 'Enter');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shortcuts: back resumes, toDesktop goes to the desktop, switchTheme switches', () => {
    const { dialog, onDesktop, onSwitchTheme, onClose } = setupMenu();
    press(dialog, 'Escape');
    press(dialog, 'KeyM');
    press(dialog, 'KeyT');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDesktop).toHaveBeenCalledTimes(1);
    expect(onSwitchTheme).toHaveBeenCalledTimes(1);
  });

  it('without a theme switcher the menu offers Desktop and Resume only', () => {
    setupMenu(false);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      expect.stringContaining('Return to desktop'),
      expect.stringContaining('Resume'),
    ]);
  });

  it('shows the user’s key for each shortcut', () => {
    setupMenu();
    expect(screen.getByRole('button', { name: /Return to desktop/ })).toHaveTextContent('M');
  });

  it('a click runs an action; a click on the backdrop resumes (mouse)', () => {
    const { dialog, onDesktop, onClose } = setupMenu();
    fireEvent.click(screen.getByRole('button', { name: /Return to desktop/ }));
    expect(onDesktop).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keys never reach listeners outside the menu', () => {
    const { dialog } = setupMenu();
    const spy = vi.fn();
    window.addEventListener('keydown', spy);
    document.body.addEventListener('keydown', spy);
    try {
      press(dialog, 'KeyM');
      expect(spy).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', spy);
      document.body.removeEventListener('keydown', spy);
    }
  });
});

const keymap: KeyMap = { left: 'focus-prev', favorite: 'toggle-favorite', help: 'show-help' };

describe('KeyHelpOverlay (FR-THM-3)', () => {
  it('renders nothing when closed', () => {
    render(<KeyHelpOverlay open={false} onClose={vi.fn()} keymap={keymap} input={input} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lists each intent with the user’s keys and gamepad buttons, plus extra rows', () => {
    render(
      <KeyHelpOverlay
        open
        onClose={vi.fn()}
        keymap={keymap}
        input={input}
        extra={[{ keys: ['T'], label: 'Switch theme' }]}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Controls' })).toBeInTheDocument();
    const favorite = screen.getByText('Toggle favorite').closest('div') as HTMLElement;
    expect(favorite).toHaveTextContent('X');
    expect(favorite).toHaveTextContent('Y');
    expect(screen.getByText('Switch theme')).toBeInTheDocument();
  });

  it('closes on back and on help', () => {
    const onClose = vi.fn();
    render(<KeyHelpOverlay open onClose={onClose} keymap={keymap} input={input} />);
    press(screen.getByRole('dialog'), 'Escape');
    press(screen.getByRole('dialog'), 'F1');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('a click outside the panel closes it (mouse)', () => {
    const onClose = vi.fn();
    render(<KeyHelpOverlay open onClose={onClose} keymap={keymap} input={input} />);
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
