// Cases ported from NextLevelOS src/themes/ThemeSwitcher.test.tsx @ 3d530b7: driven by input actions
// (keys or gamepad buttons, US-C1), one card per bundled theme (D6).
import { defaultSettings } from '@nextlevel/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { press } from '../themeTestUtils.tsx';
import { ThemeSwitcher } from './ThemeSwitcher.tsx';

const themes = [
  { id: 'big-box', nameKey: 'themes.bigBox.name', descriptionKey: 'themes.bigBox.description' },
  { id: 'big-box-list', nameKey: 'themes.bigBoxList.name' },
  { id: 'ps5', nameKey: 'themes.ps5.name' },
];

function setup(activeId = 'big-box') {
  const onApply = vi.fn<(id: string) => void>();
  const onCancel = vi.fn<() => void>();
  const outside = vi.fn();
  render(
    <div onKeyDown={outside}>
      <ThemeSwitcher
        themes={themes}
        activeId={activeId}
        input={defaultSettings().input}
        onApply={onApply}
        onCancel={onCancel}
      />
    </div>,
  );
  const dialog = screen.getByRole('dialog', { name: 'Switch theme' });
  return { onApply, onCancel, outside, dialog };
}

const pressed = () =>
  screen.getAllByRole('button').find((b) => b.getAttribute('aria-pressed') === 'true');

describe('ThemeSwitcher (FR-THM-1, US-C1)', () => {
  it('takes focus, shows one card per theme (D6) and marks the current one', () => {
    const { dialog } = setup('big-box-list');
    expect(document.activeElement).toBe(dialog);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(pressed()).toHaveTextContent('Big Box List');
    expect(pressed()).toHaveTextContent('Current');
    expect(screen.getByText('Fullscreen carousel of menu logos and box art')).toBeInTheDocument();
  });

  it('right then select applies the next theme', () => {
    const { onApply } = setup();
    press('ArrowRight');
    press('Enter');
    expect(onApply).toHaveBeenCalledWith('big-box-list');
  });

  it('left on the first card wraps to the last', () => {
    const { onApply } = setup();
    press('ArrowLeft');
    press('Enter');
    expect(onApply).toHaveBeenCalledWith('ps5');
  });

  it('back, the menu action and switchTheme cancel', () => {
    for (const code of ['Escape', 'Tab', 'KeyT']) {
      const { onCancel, onApply } = setup();
      press(code);
      expect(onCancel, code).toHaveBeenCalledTimes(1);
      expect(onApply).not.toHaveBeenCalled();
      document.body.innerHTML = '';
    }
  });

  it('FR-THM-3: a click applies a card; a click outside cancels', () => {
    const { onApply, onCancel, dialog } = setup();
    fireEvent.click(screen.getByRole('button', { name: /PS5 Style/ }));
    expect(onApply).toHaveBeenCalledWith('ps5');
    fireEvent.click(dialog);
    expect(onCancel).toHaveBeenCalled();
  });

  it('keys never reach the theme behind it', () => {
    const { outside } = setup();
    press('ArrowRight');
    expect(outside).not.toHaveBeenCalled();
  });
});
