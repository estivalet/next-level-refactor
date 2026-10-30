/**
 * Quit order for `library.db`: whatever still writes to it (the download queue, the catalog)
 * stops first, then the database closes — once, even if a step throws.
 */
export function libraryCloser(closeDb: () => void) {
  const steps: Array<() => void> = [];
  let closed = false;
  return {
    beforeClose(step: () => void): void {
      steps.push(step);
    },
    close(): void {
      if (closed) return;
      closed = true;
      for (const step of steps) {
        try {
          step();
        } catch {
          // One broken step must not keep the database open.
        }
      }
      closeDb();
    },
  };
}
