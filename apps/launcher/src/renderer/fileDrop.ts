/**
 * Cancels file drag-and-drop on the whole document, so dropping a file on the launcher never
 * navigates the window away from the app (NFR-SEC-1). Returns a function that removes the guard.
 */
export function blockFileDrops(target: Document): () => void {
  const cancel = (event: Event) => {
    event.preventDefault();
  };
  target.addEventListener('dragover', cancel);
  target.addEventListener('drop', cancel);
  return () => {
    target.removeEventListener('dragover', cancel);
    target.removeEventListener('drop', cancel);
  };
}
