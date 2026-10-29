import type { EmitEvent } from '../ipc/events.ts';
import type { CatalogInstallRepository } from '../library/CatalogInstallRepository.ts';
import type { CatalogClient } from './CatalogClient.ts';
import type { Installer } from './Installer.ts';
import type { ItemLocks } from './itemLocks.ts';

export interface CatalogSyncDeps {
  installs: Pick<CatalogInstallRepository, 'all' | 'byItem' | 'setState'>;
  client: Pick<CatalogClient, 'status'>;
  installer: Pick<Installer, 'uninstall'>;
  locks: ItemLocks;
  /** Signed in and online: a sync while offline or signed out removes nothing (D43). */
  canSync: () => boolean;
  emit: EmitEvent;
  log: { warn(context: object, msg: string): void };
}

/**
 * The lapse rule (FR-CAT-7, D43), at boot and after each hourly entitlement check: installed
 * items are compared with the catalog. `update` marks an Update; `gone` (unpublished, license
 * expired, out of the player's plan) follows the item's `on_lapse` — `keep` stays playable,
 * marked gone; `remove` uninstalls without asking (even a favorite) and tells the player which
 * games went. Each item's change waits for an install or uninstall of it. A lapsed subscription
 * locks the launcher instead and removes nothing.
 */
export class CatalogSync {
  readonly #deps: CatalogSyncDeps;
  #running: Promise<void> | null = null;

  constructor(deps: CatalogSyncDeps) {
    this.#deps = deps;
  }

  /** One sync at a time; a call during one waits for it. */
  sync(): Promise<void> {
    this.#running ??= this.#sync().finally(() => {
      this.#running = null;
    });
    return this.#running;
  }

  async #sync(): Promise<void> {
    if (!this.#deps.canSync()) return;
    const installed = this.#deps.installs.all();
    if (installed.length === 0) return;
    let answer;
    try {
      answer = await this.#deps.client.status({
        items: installed.map((install) => ({ id: install.itemId, version: install.version })),
      });
    } catch (error) {
      this.#deps.log.warn({ error }, 'catalog status check failed');
      return;
    }
    const removed: string[] = [];
    for (const item of answer.items) {
      // One item failing (a running game holds its file) never stops the others.
      await this.#deps.locks
        .run(item.id, async () => {
          const install = this.#deps.installs.byItem(item.id);
          if (!install) return;
          const onLapse = item.onLapse ?? install.onLapse;
          if (item.state === 'gone' && onLapse === 'remove') {
            await this.#deps.installer.uninstall(item.id, true);
            removed.push(install.title);
            return;
          }
          this.#deps.installs.setState(item.id, item.state, onLapse);
        })
        .catch((error: unknown) => {
          this.#deps.log.warn({ itemId: item.id, error }, 'catalog lapse step failed');
        });
    }
    if (removed.length > 0) this.#deps.emit('catalog.removed', { titles: removed });
  }
}
