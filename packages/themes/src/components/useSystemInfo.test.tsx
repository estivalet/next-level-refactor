// Cases ported from NextLevelOS src/themes/components/useSystemInfo.test.tsx @ 3d530b7: the file
// is found through the art index (FakeThemeHost) and read with fetch.
import type { ThemeSystemInfo } from '@nextlevel/shared';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeArtProvider } from '../engine/ThemeArtProvider.tsx';
import { ThemeEngineProvider } from '../engine/ThemeEngineProvider.tsx';
import { resetSystemInfoCache } from '../engine/systemInfo.ts';
import { DEFAULT_ART_CONFIG } from '../engine/useThemeArt.ts';
import { FakeThemeHost } from '../host/FakeThemeHost.ts';
import { useSystemInfo, useThemeSystemInfo } from './useSystemInfo.ts';

const entry = (systemId: string, description?: string): ThemeSystemInfo => ({
  systemId,
  models: [],
  peripherals: [],
  topGames: [],
  sources: [],
  ...(description ? { description } : {}),
});

function Probe({ name, systemId = null }: { name: string | null; systemId?: string | null }) {
  const { description } = useSystemInfo(name ? { name, systemId } : null, 0);
  return <span data-testid="desc">{description ?? '-'}</span>;
}

const host = (systemInfo: Record<string, ThemeSystemInfo> = {}) =>
  new FakeThemeHost({
    systemInfo,
    art: {
      packFiles: [],
      assetsFiles: ['system-info/NES.json', 'system-info/SNES.json'],
      manifest: null,
      warnings: [],
    },
  });

function mount(name: string | null, h = host(), systemId: string | null = null) {
  const tree = (n: string | null) => (
    <ThemeEngineProvider host={h} onExit={vi.fn()}>
      <ThemeArtProvider host={h} themeId="showcase" moduleArt={DEFAULT_ART_CONFIG}>
        <Probe name={n} systemId={systemId} />
      </ThemeArtProvider>
    </ThemeEngineProvider>
  );
  const view = render(tree(name));
  return (next: string | null) => {
    view.rerender(tree(next));
  };
}

const desc = () => screen.getByTestId('desc').textContent;

describe('useSystemInfo (FR-THM-1, FR-THM-2)', () => {
  let fetchFn: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    resetSystemInfoCache();
    fetchFn = vi.fn((url: string) => {
      const path = decodeURIComponent(url);
      if (path.endsWith('system-info/NES.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ description: 'NES text' }),
        });
      }
      if (path.endsWith('system-info/SNES.json')) return new Promise(() => undefined);
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchFn);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the description for the focused name', async () => {
    mount('NES');
    await waitFor(() => {
      expect(desc()).toBe('NES text');
    });
  });

  it('never shows an earlier name’s description', async () => {
    const rerender = mount('NES');
    await waitFor(() => {
      expect(desc()).toBe('NES text');
    });
    rerender('SNES');
    expect(desc()).toBe('-');
  });

  it('a name without a system-info file reads nothing', async () => {
    mount('Lynx');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(desc()).toBe('-');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('a null name has no description', () => {
    mount(null);
    expect(desc()).toBe('-');
  });

  it('FR-MUS-4: useSystemInfo prefers the museum description for a system node', async () => {
    mount('NES', host({ nes: entry('nes', 'Museum text') }), 'nes');
    await waitFor(() => {
      expect(desc()).toBe('Museum text');
    });
  });

  it('FR-MUS-4: falls back to system-info/<name>.json when the entry has no description', async () => {
    mount('NES', host({ nes: entry('nes') }), 'nes');
    await waitFor(() => {
      expect(desc()).toBe('NES text');
    });
  });
});

function ThemeProbe({ systemId }: { systemId: string | null }) {
  const info = useThemeSystemInfo(systemId, 0);
  return <span data-testid="info">{info?.description ?? '-'}</span>;
}

describe('useThemeSystemInfo (FR-MUS-4)', () => {
  it('FR-MUS-4: useThemeSystemInfo reloads on system-info-changed for that system', async () => {
    const h = host({ nes: entry('nes', 'old') });
    render(
      <ThemeEngineProvider host={h} onExit={vi.fn()}>
        <ThemeProbe systemId="nes" />
      </ThemeEngineProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('info').textContent).toBe('old');
    });
    vi.spyOn(h, 'getSystemInfo').mockResolvedValue(entry('nes', 'new'));
    act(() => {
      h.emit({ type: 'system-info-changed', systemId: 'snes' });
    });
    expect(screen.getByTestId('info').textContent).toBe('old');
    act(() => {
      h.emit({ type: 'system-info-changed', systemId: 'nes' });
    });
    await waitFor(() => {
      expect(screen.getByTestId('info').textContent).toBe('new');
    });
  });

  it('FR-MUS-4: settings-changed drops cached entries (custom systems come from settings)', async () => {
    const h = host({ nes: entry('nes', 'old') });
    render(
      <ThemeEngineProvider host={h} onExit={vi.fn()}>
        <ThemeProbe systemId="nes" />
      </ThemeEngineProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('info').textContent).toBe('old');
    });
    vi.spyOn(h, 'getSystemInfo').mockResolvedValue(entry('nes', 'new'));
    act(() => {
      h.emit({ type: 'settings-changed' });
    });
    await waitFor(() => {
      expect(screen.getByTestId('info').textContent).toBe('new');
    });
  });

  it('FR-MUS-4: unmount, event, remount shows the new text', async () => {
    const h = host({ nes: entry('nes', 'old') });
    const tree = (
      <ThemeEngineProvider host={h} onExit={vi.fn()}>
        <ThemeProbe systemId="nes" />
      </ThemeEngineProvider>
    );
    const first = render(tree);
    await waitFor(() => {
      expect(screen.getByTestId('info').textContent).toBe('old');
    });
    first.unmount();
    vi.spyOn(h, 'getSystemInfo').mockResolvedValue(entry('nes', 'new'));
    h.emit({ type: 'system-info-changed', systemId: 'nes' });
    render(tree);
    await waitFor(() => {
      expect(screen.getByTestId('info').textContent).toBe('new');
    });
  });
});
