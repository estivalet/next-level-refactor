// Cases ported from NextLevelOS src/themes/components/useSystemInfo.test.tsx @ 3d530b7: the file
// is found through the art index (FakeThemeHost) and read with fetch.
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeArtProvider } from '../engine/ThemeArtProvider.tsx';
import { ThemeEngineProvider } from '../engine/ThemeEngineProvider.tsx';
import { resetSystemInfoCache } from '../engine/systemInfo.ts';
import { DEFAULT_ART_CONFIG } from '../engine/useThemeArt.ts';
import { FakeThemeHost } from '../host/FakeThemeHost.ts';
import { useSystemInfo } from './useSystemInfo.ts';

function Probe({ name }: { name: string | null }) {
  const { description } = useSystemInfo(name, 0);
  return <span data-testid="desc">{description ?? '-'}</span>;
}

const host = () =>
  new FakeThemeHost({
    art: {
      packFiles: [],
      assetsFiles: ['system-info/NES.json', 'system-info/SNES.json'],
      manifest: null,
      warnings: [],
    },
  });

function mount(name: string | null, h = host()) {
  const tree = (n: string | null) => (
    <ThemeEngineProvider host={h} onExit={vi.fn()}>
      <ThemeArtProvider host={h} themeId="showcase" moduleArt={DEFAULT_ART_CONFIG}>
        <Probe name={n} />
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
});
