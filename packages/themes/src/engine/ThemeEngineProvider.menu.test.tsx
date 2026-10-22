import { act, render, waitFor } from '@testing-library/react';
import type { MenuNode, MenuTree } from '@nextlevel/shared';
import { describe, expect, it, vi } from 'vitest';
import { FakeThemeHost } from '../host/FakeThemeHost.ts';
import { FIXTURE_MENU } from '../host/fixtures.ts';
import { ThemeEngineProvider } from './ThemeEngineProvider.tsx';
import { useThemeNavigation, type ThemeNavigation } from './useThemeNavigation.ts';

function setup(host: FakeThemeHost) {
  const nav: { current: ThemeNavigation | null } = { current: null };
  function Probe() {
    nav.current = useThemeNavigation();
    return null;
  }
  render(
    <ThemeEngineProvider host={host} onExit={vi.fn()}>
      <Probe />
    </ThemeEngineProvider>,
  );
  const get = () => {
    if (!nav.current) throw new Error('not rendered');
    return nav.current;
  };
  return { get };
}

const [nintendo, sega, collections] = FIXTURE_MENU.items as [MenuNode, MenuNode, MenuNode];
const saturn = sega.children[1] as MenuNode;
const genesis = sega.children[0] as MenuNode;

/** The user's edit: Sega renamed SEGA, moved first, Saturn first inside it. */
const edited: MenuTree = {
  title: 'NextLevel',
  items: [
    { ...sega, name: 'SEGA', display: 'SEGA', children: [saturn, genesis] },
    nintendo,
    collections,
  ],
};

describe('menu-changed (US-D5, FR-MENU-1)', () => {
  it('reloads the menu and keeps focus on the same category id', async () => {
    const host = new FakeThemeHost();
    const ctx = setup(host);
    await waitFor(() => {
      expect(ctx.get().state.status).toBe('ready');
    });
    act(() => {
      ctx.get().setFocus(1);
    });
    host.setMenu(edited);
    act(() => {
      host.emit({ type: 'menu-changed' });
    });
    await waitFor(() => {
      expect(ctx.get().focusedNode?.display).toBe('SEGA');
    });
    expect(ctx.get().state.focusIndex).toBe(0);
  });

  it('an open games level whose node was removed goes back to its parent', async () => {
    const host = new FakeThemeHost();
    const ctx = setup(host);
    await waitFor(() => {
      expect(ctx.get().state.status).toBe('ready');
    });
    act(() => {
      ctx.get().enter(1);
    });
    act(() => {
      ctx.get().enter(1);
    });
    await waitFor(() => {
      const level = ctx.get().currentLevel;
      expect(level?.kind === 'games' && !level.loading).toBe(true);
    });
    host.setMenu({ ...FIXTURE_MENU, items: [nintendo, { ...sega, children: [genesis] }] });
    act(() => {
      host.emit({ type: 'menu-changed' });
    });
    await waitFor(() => {
      expect(ctx.get().currentLevel?.node?.id).toBe('m:sega');
    });
    expect(ctx.get().focusedNode?.id).toBe('s:genesis');
  });

  it('an open games level that still exists is refreshed in place', async () => {
    const host = new FakeThemeHost();
    const ctx = setup(host);
    await waitFor(() => {
      expect(ctx.get().state.status).toBe('ready');
    });
    act(() => {
      ctx.get().enter(0);
    });
    act(() => {
      ctx.get().enter(1);
    });
    await waitFor(() => {
      const level = ctx.get().currentLevel;
      expect(level?.kind === 'games' && !level.loading).toBe(true);
    });
    act(() => {
      ctx.get().setFocus(3);
    });
    const before = host.calls.length;
    host.setMenu(edited);
    act(() => {
      host.emit({ type: 'menu-changed' });
    });
    await waitFor(() => {
      expect(host.calls.slice(before)).toContainEqual({ method: 'getGames', args: ['s:n64'] });
    });
    expect(ctx.get().currentLevel?.node?.id).toBe('s:n64');
    expect(ctx.get().state.focusIndex).toBe(3);
  });
});
