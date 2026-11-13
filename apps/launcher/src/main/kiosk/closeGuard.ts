/**
 * The window's own close (title-bar X, Alt+F4) while kiosk is locked and hides Quit (FR-SET-6,
 * D54): refused like `app.quit`. Quits NextLevel starts itself pass `before-quit` first
 * (`quitting`), so app.quit, an update install and the test harness still close it.
 */
export function createCloseGuard(deps: {
  guard: () => void;
  quitting: () => boolean;
}): (event: { preventDefault(): void }) => void {
  return (event) => {
    if (deps.quitting()) return;
    try {
      deps.guard();
    } catch {
      event.preventDefault();
    }
  };
}
