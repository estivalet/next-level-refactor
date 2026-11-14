import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShellCrash } from './ShellCrash.tsx';

let aDown = false;
afterEach(() => {
  Reflect.deleteProperty(navigator, 'getGamepads');
  aDown = false;
});

describe('ShellCrash (NFR-REL-2)', () => {
  it('NFR-REL-2: A on a gamepad reloads NextLevel from the whole-launcher crash screen', async () => {
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [
        {
          mapping: 'standard',
          axes: [0, 0, 0, 0],
          buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: aDown && i === 0, value: 0 })),
        },
      ],
    });
    const reload = vi.fn();
    render(<ShellCrash onReload={reload} />);
    expect(screen.getByRole('alert')).toBeVisible();
    aDown = true;
    await vi.waitFor(() => {
      expect(reload).toHaveBeenCalledTimes(1);
    });
  });

  it('NFR-REL-2: Enter reloads once', async () => {
    const reload = vi.fn();
    render(<ShellCrash onReload={reload} />);
    expect(screen.getByRole('alert')).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('alert'), { key: 'Enter', code: 'Enter' });
    await vi.waitFor(() => {
      expect(reload).toHaveBeenCalledTimes(1);
    });
  });
});
