import { describe, expect, it } from 'vitest';
import { FakeThemeHost } from './FakeThemeHost.ts';
import type { HostEvent, ThemeHost } from './ThemeHost.ts';

describe('FakeThemeHost', () => {
  it('FR-THM-6: implements ThemeHost over fixtures', async () => {
    const host: ThemeHost = new FakeThemeHost();
    const menu = await host.getMenu();
    expect(menu.items.map((node) => node.id)).toEqual(['m:nintendo', 'm:sega', 'm:collections']);
    const homebrew = await host.getGames('s:snes:f:homebrew');
    expect(homebrew.length).toBeGreaterThan(0);
    expect(homebrew.every((game) => game.filters.includes('homebrew'))).toBe(true);
    expect((await host.getGames('s:snes')).length).toBe(10);
    expect((await host.getGames('c:1')).length).toBe(3);
  });

  it('FR-THM-6: media URLs exist only for indexed kinds', async () => {
    const host = new FakeThemeHost();
    const [game] = await host.getGames('s:snes');
    if (!game) throw new Error('fixture');
    expect(host.mediaUrl(game, 'box-front')).toBe(`nextlevel://media/${String(game.id)}/box-front`);
    expect(host.mediaUrl(game, 'marquee')).toBeNull();
  });

  it('FR-THM-6: records calls, fails on request and delivers events', async () => {
    const host = new FakeThemeHost({ failFlags: true, failLaunch: 'Emulator missing' });
    expect(await host.setGameFlags(1, { favorite: true })).toBe(false);
    expect(await host.launch(1)).toEqual({ ok: false, message: 'Emulator missing' });
    const seen: HostEvent[] = [];
    const off = host.onEvent((event) => seen.push(event));
    host.emit({ type: 'launch-finished', gameId: 1, ok: true });
    off();
    host.emit({ type: 'settings-changed' });
    expect(seen).toEqual([{ type: 'launch-finished', gameId: 1, ok: true }]);
    expect(host.calls.map((call) => call.method)).toEqual(['setGameFlags', 'launch']);
  });
});
