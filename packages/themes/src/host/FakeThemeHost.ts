import {
  artUrl,
  defaultSettings,
  mediaUrl,
  type ArtIndex,
  type ArtRoot,
  type InputSettings,
  type MenuTree,
  type ThemeGame,
  type ThemeOptions,
} from '@nextlevel/shared';
import { FIXTURE_ART, FIXTURE_COLLECTION, FIXTURE_GAMES, FIXTURE_MENU } from './fixtures.ts';
import type { HostEvent, LaunchOutcome, ThemeHost } from './ThemeHost.ts';

export interface HostFixture {
  menu?: MenuTree;
  games?: readonly ThemeGame[];
  art?: ArtIndex;
  options?: Record<string, ThemeOptions>;
  /** Input settings; defaults to the US-C1 bindings. */
  input?: InputSettings;
  /** setGameFlags resolves false. */
  failFlags?: boolean;
  /** launch resolves `{ ok: false, message }`. */
  failLaunch?: string;
}

export interface HostCall {
  method: 'getGames' | 'launch' | 'setGameFlags' | 'loadArtIndex';
  args: unknown[];
}

/** A ThemeHost over in-memory fixtures, for engine and theme tests (FR-THM-6). */
export class FakeThemeHost implements ThemeHost {
  readonly calls: HostCall[] = [];
  private readonly listeners = new Set<(event: HostEvent) => void>();
  private games: ThemeGame[];

  constructor(private readonly fixture: HostFixture = {}) {
    this.games = [...(fixture.games ?? FIXTURE_GAMES)];
  }

  getMenu(): Promise<MenuTree> {
    return Promise.resolve(this.fixture.menu ?? FIXTURE_MENU);
  }

  getGames(nodeId: string): Promise<ThemeGame[]> {
    this.calls.push({ method: 'getGames', args: [nodeId] });
    const filter = /^s:([^:]+):f:(.+)$/.exec(nodeId);
    const system = /^s:([^:]+)$/.exec(nodeId);
    if (filter) {
      return Promise.resolve(
        this.games.filter((g) => g.systemId === filter[1] && g.filters.includes(filter[2] ?? '')),
      );
    }
    if (system) return Promise.resolve(this.games.filter((g) => g.systemId === system[1]));
    if (nodeId === 'c:1') {
      return Promise.resolve(
        FIXTURE_COLLECTION.flatMap((id) => this.games.filter((g) => g.id === id)),
      );
    }
    return Promise.reject(new Error(`unknown node ${nodeId}`));
  }

  /** Replaces the games behind every level, e.g. before emitting `library-changed`. */
  setGames(games: readonly ThemeGame[]): void {
    this.games = [...games];
  }

  getGameDetails(gameId: number): Promise<{ description: string | null }> {
    return Promise.resolve({ description: `About game ${String(gameId)}` });
  }

  loadArtIndex(themeId: string): Promise<ArtIndex> {
    this.calls.push({ method: 'loadArtIndex', args: [themeId] });
    return Promise.resolve(this.fixture.art ?? FIXTURE_ART);
  }

  mediaUrl(game: ThemeGame, kind: string): string | null {
    return game.media.includes(kind) ? mediaUrl(game.id, kind) : null;
  }

  artUrl(root: ArtRoot, rel: string): string {
    return artUrl(root, rel);
  }

  launch(gameId: number): Promise<LaunchOutcome> {
    this.calls.push({ method: 'launch', args: [gameId] });
    const failure = this.fixture.failLaunch;
    return Promise.resolve(failure ? { ok: false, message: failure } : { ok: true });
  }

  setGameFlags(gameId: number, flags: { favorite?: boolean; hidden?: boolean }): Promise<boolean> {
    this.calls.push({ method: 'setGameFlags', args: [gameId, flags] });
    return Promise.resolve(!this.fixture.failFlags);
  }

  themeOptions(themeId: string): ThemeOptions | undefined {
    return this.fixture.options?.[themeId];
  }

  input(): InputSettings {
    return this.fixture.input ?? defaultSettings().input;
  }

  onEvent(listener: (event: HostEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: HostEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
