import { defaultSettings, type InputAction } from '@nextlevel/shared';
import { useInputActions } from '@nextlevel/themes';
import { useMemo, useState, type RefObject } from 'react';
import { useSettings } from '../settings/settingsApi.ts';

/**
 * Keyboard and gamepad for a part of the Catalog (D47), with the player's Settings → Input
 * bindings: on only while focus is inside `target`, so a pad drives the window in use.
 * Answers focus handlers for the target element.
 */
export function useCatalogInput(
  target: RefObject<HTMLElement | null>,
  onAction: (action: InputAction) => void,
) {
  const loaded = useSettings().data;
  const input = useMemo(
    () => (loaded?.kind === 'ok' ? loaded.snapshot.settings : defaultSettings()).input,
    [loaded],
  );
  const [focused, setFocused] = useState(false);
  useInputActions({ targetRef: target, enabled: focused, input, onAction });
  return {
    onFocus: () => {
      setFocused(true);
    },
    onBlur: (event: React.FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
    },
  };
}

/** Clicks the focused button (`select`). */
export function pressFocused(): void {
  if (document.activeElement instanceof HTMLButtonElement) document.activeElement.click();
}
