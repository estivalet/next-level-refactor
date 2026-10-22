// Cases ported from NextLevelOS src/themes/components/useNavigationSound.test.tsx @ 3d530b7: sound
// URLs come from the art provider's `sound(name)`, and levels are identified by node id.
import type { MenuNode } from '@nextlevel/shared';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Level } from '../engine/types.ts';
import { NO_ART, ThemeArtContext } from '../engine/useThemeArt.ts';
import { resetSoundEngine } from './soundEngine.ts';
import { levelIdentity, useNavigationSound } from './useNavigationSound.ts';

let candidatesFor = (name: string) => [`nl://pack/${name}.wav`, `nl://assets/${name}.wav`];

/** Files that "exist" (fetch ok); a url containing "bad" fails to decode. */
let existing = new Set<string>();
const started: string[] = [];
const stopped: string[] = [];
let contexts = 0;

interface FakeBuffer {
  url: string;
}

class FakeSource {
  buffer: FakeBuffer | null = null;
  connect() {
    return undefined;
  }
  start() {
    started.push(this.buffer?.url ?? '');
  }
  stop() {
    stopped.push(this.buffer?.url ?? '');
  }
}
class FakeGain {
  gain = { value: 1 };
  connect() {
    return undefined;
  }
}
class FakeAudioContext {
  state = 'running';
  destination = {};
  constructor() {
    contexts += 1;
  }
  resume() {
    return Promise.resolve();
  }
  createBufferSource() {
    return new FakeSource();
  }
  createGain() {
    return new FakeGain();
  }
  decodeAudioData(data: FakeBuffer) {
    return data.url.includes('bad')
      ? Promise.reject(new Error('cannot decode'))
      : Promise.resolve({ url: data.url });
  }
}

const fetchMock = vi.fn((url: string) =>
  Promise.resolve({ ok: existing.has(url), arrayBuffer: () => Promise.resolve({ url }) }),
);

const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

function wrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeArtContext.Provider value={{ ...NO_ART, sound: (name) => candidatesFor(name) }}>
      {children}
    </ThemeArtContext.Provider>
  );
}

type Opts = Parameters<typeof useNavigationSound>[0];
async function setup(initial: Opts) {
  const hook = renderHook(
    (props: Opts) => {
      useNavigationSound(props);
    },
    { initialProps: initial, wrapper },
  );
  await flush();
  return hook;
}

beforeEach(() => {
  started.length = 0;
  stopped.length = 0;
  contexts = 0;
  existing = new Set(['nl://pack/move-menu.wav', 'nl://pack/move-games.wav']);
  candidatesFor = (name) => [`nl://pack/${name}.wav`, `nl://assets/${name}.wav`];
  resetSoundEngine();
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetSoundEngine();
});

describe('useNavigationSound (FR-THM-1, FR-THM-4)', () => {
  it('is silent on mount', async () => {
    await setup({ focusKey: 0, levelKey: 'a', levelKind: 'menu' });
    expect(started).toEqual([]);
  });

  it('plays move-menu when focus moves on a menu level', async () => {
    const { rerender } = await setup({ focusKey: 0, levelKey: 'a', levelKind: 'menu' });
    rerender({ focusKey: 1, levelKey: 'a', levelKind: 'menu' });
    expect(started).toEqual(['nl://pack/move-menu.wav']);
  });

  it('plays move-games when focus moves on a games level', async () => {
    const { rerender } = await setup({ focusKey: 'x', levelKey: 'g', levelKind: 'games' });
    rerender({ focusKey: 'y', levelKey: 'g', levelKind: 'games' });
    expect(started).toEqual(['nl://pack/move-games.wav']);
  });

  it('stays silent when the level changes, even if focus changes with it', async () => {
    const { rerender } = await setup({ focusKey: 3, levelKey: 'a', levelKind: 'menu' });
    rerender({ focusKey: 0, levelKey: 'b', levelKind: 'menu' });
    expect(started).toEqual([]);
  });

  it('stays silent while muted', async () => {
    const { rerender } = await setup({
      focusKey: 0,
      levelKey: 'g',
      levelKind: 'games',
      muted: true,
    });
    rerender({ focusKey: 1, levelKey: 'g', levelKind: 'games', muted: true });
    expect(started).toEqual([]);
  });

  it('is silent when focus settles from -1 (a list finishing loading)', async () => {
    const { rerender } = await setup({ focusKey: -1, levelKey: 'g', levelKind: 'games' });
    rerender({ focusKey: 0, levelKey: 'g', levelKind: 'games' });
    expect(started).toEqual([]);
    rerender({ focusKey: 1, levelKey: 'g', levelKind: 'games' });
    expect(started).toEqual(['nl://pack/move-games.wav']);
  });

  it('is silent on the render where muting ends (closing a search jumps the index)', async () => {
    const { rerender } = await setup({
      focusKey: 0,
      levelKey: 'g',
      levelKind: 'games',
      muted: true,
    });
    rerender({ focusKey: 57, levelKey: 'g', levelKind: 'games', muted: false });
    expect(started).toEqual([]);
    rerender({ focusKey: 58, levelKey: 'g', levelKind: 'games', muted: false });
    expect(started).toEqual(['nl://pack/move-games.wav']);
  });

  it('rapid moves restart the sound: each new blip stops the previous one', async () => {
    const { rerender } = await setup({ focusKey: 0, levelKey: 'g', levelKind: 'games' });
    for (let i = 1; i <= 5; i++) rerender({ focusKey: i, levelKey: 'g', levelKind: 'games' });
    expect(started).toHaveLength(5);
    expect(stopped).toHaveLength(4);
  });

  it('falls through to the next candidate when a file is missing or cannot be decoded', async () => {
    candidatesFor = (name) => [`nl://pack/${name}-bad.wav`, `nl://assets/${name}.wav`];
    existing = new Set(['nl://pack/move-menu-bad.wav', 'nl://assets/move-menu.wav']);
    const { rerender } = await setup({ focusKey: 0, levelKey: 'a', levelKind: 'menu' });
    rerender({ focusKey: 1, levelKey: 'a', levelKind: 'menu' });
    expect(started).toEqual(['nl://assets/move-menu.wav']);
  });

  it('creates no audio context when there are no sound files', async () => {
    candidatesFor = () => [];
    const { rerender } = await setup({ focusKey: 0, levelKey: 'a', levelKind: 'menu' });
    rerender({ focusKey: 1, levelKey: 'a', levelKind: 'menu' });
    expect(contexts).toBe(0);
    expect(started).toEqual([]);
  });

  it('shares one audio context and reads each file once', async () => {
    await setup({ focusKey: 0, levelKey: 'a', levelKind: 'menu' });
    await setup({ focusKey: 0, levelKey: 'b', levelKind: 'menu' });
    expect(contexts).toBe(1);
    const menuFetches = fetchMock.mock.calls.filter(([u]) => u === 'nl://pack/move-menu.wav');
    expect(menuFetches).toHaveLength(1);
  });

  it('is silent, without throwing, where Web Audio is unavailable', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const { rerender } = await setup({ focusKey: 0, levelKey: 'a', levelKind: 'menu' });
    expect(() => {
      rerender({ focusKey: 1, levelKey: 'a', levelKind: 'menu' });
    }).not.toThrow();
    expect(started).toEqual([]);
  });
});

describe('levelIdentity', () => {
  const node = { id: 's:snes', name: 'Super Nintendo' } as MenuNode;
  it('names menu and games levels distinctly by node id', () => {
    expect(levelIdentity(null)).toBe('');
    expect(levelIdentity({ kind: 'menu', node: null } as Level)).toBe('m:root');
    expect(levelIdentity({ kind: 'menu', node } as Level)).toBe('m:s:snes');
    expect(levelIdentity({ kind: 'games', node } as Level)).toBe('g:s:snes');
  });
});
