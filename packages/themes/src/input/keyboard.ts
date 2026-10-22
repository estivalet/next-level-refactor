import { INPUT_ACTIONS, type InputAction, type InputSettings } from '@nextlevel/shared';

/** Every action bound to a key code (`KeyboardEvent.code`), in INPUT_ACTIONS order. */
export function keyboardActions(code: string, input: InputSettings): InputAction[] {
  return INPUT_ACTIONS.filter((action) => input.keyboard[action].includes(code));
}

const TEXT_EXITS = new Set(['Escape', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** While typing in a text field (in-list search), only these keys reach the theme. */
export function passesTextInput(code: string): boolean {
  return TEXT_EXITS.has(code);
}

/** True for elements that take typed text. */
export function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  return (
    target instanceof HTMLInputElement && !['checkbox', 'radio', 'button'].includes(target.type)
  );
}
