// Cases ported from NextLevelOS src/themes/components/useGamesLevelController.test.tsx @ 3d530b7,
// on a FakeThemeHost (Nintendo → Nintendo 64 has 8 games, N64 A..H).
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useMemo, useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { ThemeEngineProvider } from '../engine/ThemeEngineProvider.tsx';
import type { NavIntentKind } from '../engine/types.ts';
import { useThemeNavigation } from '../engine/useThemeNavigation.ts';
import { FakeThemeHost } from '../host/FakeThemeHost.ts';
import { buildFilterTabs } from './gameTabs.ts';
import { useGamesLevelController } from './useGamesLevelController.ts';

const INTENTS: NavIntentKind[] = [
  'focus-down',
  'focus-prev',
  'focus-next',
  'enter',
  'back',
  'toggle-favorite',
  'toggle-hidden',
  'tab-next',
];

function Harness({ columns = 2, wrap = false }: { columns?: number; wrap?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const nav = useThemeNavigation();
  const level = nav.currentLevel;
  const filterTabs = level?.kind === 'games' ? level.filterTabs : undefined;
  // Memoized like a theme does: new tab objects would reset the active tab.
  const tabs = useMemo(() => (filterTabs ? buildFilterTabs(filterTabs) : undefined), [filterTabs]);
  const c = useGamesLevelController({
    rootRef,
    columns,
    wrap,
    ...(tabs ? { tabs: tabs.tabs, defaultTabId: tabs.defaultTabId } : {}),
  });
  return (
    <div ref={rootRef} tabIndex={0}>
      <span data-testid="depth">{nav.state.stack.length}</span>
      <span data-testid="focused">{c.focusedGame?.title ?? ''}</span>
      <span data-testid="toast">{c.toast ?? ''}</span>
      <span data-testid="search">{String(c.tabbed.search.isOpen)}</span>
      <span data-testid="tab">{c.tabbed.activeTabId}</span>
      <span data-testid="remembered">
        {level?.kind === 'games' ? (level.filterTab ?? '-') : ''}
      </span>
      <button
        type="button"
        onClick={() => {
          nav.enter(0);
        }}
      >
        enter-0
      </button>
      <button
        type="button"
        onClick={() => {
          nav.enter(1);
        }}
      >
        enter-1
      </button>
      <button
        type="button"
        onClick={() => {
          nav.enter(0, { flattenFilters: true });
        }}
      >
        enter-flat
      </button>
      <button
        type="button"
        onClick={() => {
          c.tabbed.search.open();
        }}
      >
        open-search
      </button>
      {INTENTS.map((intent) => (
        <button
          type="button"
          key={intent}
          onClick={() => {
            c.handleIntent(intent);
          }}
        >
          {intent}
        </button>
      ))}
    </div>
  );
}

const text = (id: string) => screen.getByTestId(id).textContent;
const click = (name: string) => {
  fireEvent.click(screen.getByText(name));
};

async function openN64(host = new FakeThemeHost(), props: Parameters<typeof Harness>[0] = {}) {
  render(
    <ThemeEngineProvider host={host} onExit={() => undefined}>
      <Harness {...props} />
    </ThemeEngineProvider>,
  );
  await waitFor(() => {
    expect(text('depth')).toBe('1');
  });
  click('enter-0');
  click('enter-1');
  await waitFor(() => {
    expect(text('focused')).toBe('N64 A');
  });
  return host;
}

describe('useGamesLevelController (FR-THM-1, FR-THM-3)', () => {
  it('moves by a full row using the given column count', async () => {
    await openN64();
    click('focus-down');
    expect(text('focused')).toBe('N64 C');
  });

  it('enter launches the display-focused game', async () => {
    const host = await openN64();
    click('focus-next');
    click('enter');
    const launches = host.calls.filter((call) => call.method === 'launch');
    expect(launches.map((call) => call.args[0])).toHaveLength(1);
  });

  it('a failed launch shows its reason', async () => {
    await openN64(new FakeThemeHost({ failLaunch: 'Emulator not found' }));
    click('enter');
    await waitFor(() => {
      expect(text('toast')).toBe('Emulator not found');
    });
  });

  it('back closes an open search instead of navigating', async () => {
    await openN64();
    click('open-search');
    expect(text('search')).toBe('true');
    click('back');
    expect(text('search')).toBe('false');
    expect(text('depth')).toBe('3');
  });

  it('shows a toast when saving a flag fails', async () => {
    await openN64(new FakeThemeHost({ failFlags: true }));
    click('toggle-favorite');
    await waitFor(() => {
      expect(text('toast')).toBe('Couldn’t save favorite');
    });
  });

  it('hiding the focused game moves on to the next one in the All tab', async () => {
    await openN64();
    click('toggle-hidden');
    await waitFor(() => {
      expect(text('focused')).toBe('N64 B');
    });
  });

  it('tab-next cycles the tabs', async () => {
    await openN64();
    click('tab-next');
    expect(text('tab')).toBe('favorites');
  });

  it('wraps both ends when wrap is true; clamps by default', async () => {
    await openN64(new FakeThemeHost(), { columns: Number.MAX_SAFE_INTEGER, wrap: true });
    click('focus-prev');
    expect(text('focused')).toBe('N64 H');
    click('focus-next');
    expect(text('focused')).toBe('N64 A');
    click('focus-down');
    expect(text('focused')).toBe('N64 A');
  });

  it('clamps at the first game without wrap', async () => {
    await openN64();
    click('focus-prev');
    expect(text('focused')).toBe('N64 A');
  });

  it('records the active filter tab on the level so a theme switch can land on it', async () => {
    render(
      <ThemeEngineProvider host={new FakeThemeHost()} onExit={() => undefined}>
        <Harness />
      </ThemeEngineProvider>,
    );
    await waitFor(() => {
      expect(text('depth')).toBe('1');
    });
    click('enter-0');
    click('enter-flat');
    await waitFor(() => {
      expect(text('remembered')).toBe('official');
    });
    click('tab-next');
    await waitFor(() => {
      expect(text('remembered')).toBe('homebrew');
    });
  });
});
