import { defaultSettings, type InputAction } from '@nextlevel/shared';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import type { PadSnapshot } from './gamepad.ts';
import { useInputActions, type InputActionsDeps } from './useInputActions.ts';

/** A controllable clock, frame loop and gamepad. */
function harness() {
  let time = 0;
  let frame: (() => void) | null = null;
  let pressed: number[] = [];
  let connected = true;
  const deps: InputActionsDeps = {
    now: () => time,
    requestFrame: (callback) => {
      frame = callback;
      return 1;
    },
    cancelFrame: () => {
      frame = null;
    },
    getPads: (): Array<PadSnapshot | null> =>
      connected
        ? [
            {
              mapping: 'standard',
              axes: [0, 0],
              buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })),
            },
          ]
        : [],
  };
  const advance = (ms: number) => {
    for (let step = 0; step < ms; step += 10) {
      time += 10;
      act(() => frame?.());
    }
  };
  return {
    deps,
    advance,
    press: (...buttons: number[]) => {
      pressed = buttons;
    },
    unplug: () => {
      connected = false;
    },
  };
}

function Probe(props: { deps: InputActionsDeps; enabled?: boolean; fired: InputAction[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useInputActions({
    targetRef: ref,
    enabled: props.enabled ?? true,
    input: defaultSettings().input,
    onAction: (action) => props.fired.push(action),
    deps: props.deps,
  });
  return (
    <div ref={ref} tabIndex={0} data-testid="root">
      <input aria-label="search" />
    </div>
  );
}

describe('useInputActions (FR-THM-3, US-C1)', () => {
  it('a key fires its action once; the OS key repeat is ignored', () => {
    const { deps } = harness();
    const fired: InputAction[] = [];
    render(<Probe deps={deps} fired={fired} />);
    fireEvent.keyDown(screen.getByTestId('root'), { code: 'KeyX' });
    fireEvent.keyDown(screen.getByTestId('root'), { code: 'KeyX', repeat: true });
    expect(fired).toEqual(['favorite']);
  });

  it('a held arrow repeats after 400 ms at 10 per second and stops on release', () => {
    const { deps, advance } = harness();
    const fired: InputAction[] = [];
    render(<Probe deps={deps} fired={fired} />);
    fireEvent.keyDown(screen.getByTestId('root'), { code: 'ArrowDown' });
    advance(600);
    expect(fired).toEqual(['down', 'down', 'down', 'down']);
    fireEvent.keyUp(screen.getByTestId('root'), { code: 'ArrowDown' });
    advance(500);
    expect(fired).toHaveLength(4);
  });

  it('typing in a text field only lets Escape, Enter and arrows through', () => {
    const { deps } = harness();
    const fired: InputAction[] = [];
    render(<Probe deps={deps} fired={fired} />);
    const search = screen.getByRole('textbox', { name: 'search' });
    fireEvent.keyDown(search, { code: 'KeyF' });
    fireEvent.keyDown(search, { code: 'Escape' });
    expect(fired).toEqual(['back']);
  });

  it('a gamepad button fires once while held', () => {
    const { deps, advance, press } = harness();
    const fired: InputAction[] = [];
    render(<Probe deps={deps} fired={fired} />);
    press(0);
    advance(1000);
    expect(fired).toEqual(['select']);
  });

  it('after the window loses focus a held direction stops repeating', () => {
    const { deps, advance, press } = harness();
    const fired: InputAction[] = [];
    render(<Probe deps={deps} fired={fired} />);
    press(13);
    advance(100);
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    advance(1000);
    expect(fired).toEqual(['down']);
    press();
    advance(20);
    press(13);
    advance(20);
    expect(fired).toEqual(['down', 'down']);
  });

  it('a button held while input was off does nothing until pressed again', () => {
    const { deps, advance, press } = harness();
    const fired: InputAction[] = [];
    const { rerender } = render(<Probe deps={deps} enabled={false} fired={fired} />);
    press(0);
    rerender(<Probe deps={deps} enabled fired={fired} />);
    advance(200);
    expect(fired).toEqual([]);
    press();
    advance(20);
    press(0);
    advance(20);
    expect(fired).toEqual(['select']);
  });

  it('unplugging a pad mid-hold leaves nothing stuck', () => {
    const { deps, advance, press, unplug } = harness();
    const fired: InputAction[] = [];
    render(<Probe deps={deps} fired={fired} />);
    press(15);
    advance(100);
    unplug();
    advance(1000);
    expect(fired).toEqual(['right']);
  });

  it('View then Start then releasing Start fires only toDesktop', () => {
    const { deps, advance, press } = harness();
    const fired: InputAction[] = [];
    render(<Probe deps={deps} fired={fired} />);
    press(8);
    advance(50);
    press(8, 9);
    advance(50);
    press(8);
    advance(50);
    press();
    advance(50);
    expect(fired).toEqual(['toDesktop']);
  });

  it('a key released outside the theme still stops its repeat', () => {
    const { deps, advance } = harness();
    const fired: InputAction[] = [];
    render(<Probe deps={deps} fired={fired} />);
    fireEvent.keyDown(screen.getByTestId('root'), { code: 'ArrowDown' });
    fireEvent.keyUp(window, { code: 'ArrowDown' });
    advance(1000);
    expect(fired).toEqual(['down']);
  });

  it('focus leaving the theme forgets held keys', () => {
    const { deps, advance } = harness();
    const fired: InputAction[] = [];
    render(
      <>
        <Probe deps={deps} fired={fired} />
        <button type="button">outside</button>
      </>,
    );
    fireEvent.keyDown(screen.getByTestId('root'), { code: 'ArrowDown' });
    fireEvent.focusOut(screen.getByTestId('root'), {
      relatedTarget: screen.getByRole('button', { name: 'outside' }),
    });
    advance(1000);
    expect(fired).toEqual(['down']);
  });

  it('focus moving inside the theme keeps held keys', () => {
    const { deps, advance } = harness();
    const fired: InputAction[] = [];
    render(<Probe deps={deps} fired={fired} />);
    fireEvent.keyDown(screen.getByTestId('root'), { code: 'ArrowDown' });
    fireEvent.focusOut(screen.getByTestId('root'), {
      relatedTarget: screen.getByRole('textbox', { name: 'search' }),
    });
    advance(450);
    expect(fired).toEqual(['down', 'down']);
  });
});
