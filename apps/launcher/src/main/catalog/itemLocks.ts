/**
 * One change at a time per catalog item: install, uninstall and the lapse sync of the same item
 * wait for each other (D43); different items run side by side.
 */
export class ItemLocks {
  readonly #tails = new Map<string, Promise<unknown>>();

  run<T>(itemId: string, work: () => Promise<T>): Promise<T> {
    const previous = this.#tails.get(itemId) ?? Promise.resolve();
    const result = previous.then(work, work);
    const tail = result.catch(() => undefined);
    this.#tails.set(itemId, tail);
    void tail.then(() => {
      if (this.#tails.get(itemId) === tail) this.#tails.delete(itemId);
    });
    return result;
  }
}
