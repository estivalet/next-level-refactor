// Ported from NextLevelOS src/themes/components/useNavigationSound.ts @ 3d530b7 (sound URLs come
// from the art provider; levels are identified by node id).
import { defaultSettings, type ThemeSound } from '@nextlevel/shared';
import { useContext, useEffect, useRef, useState } from 'react';
import type { Level } from '../engine/types.ts';
import { useThemeArt } from '../engine/useThemeArt.ts';
import { ThemeHostContext } from '../engine/useThemeNavigation.ts';
import { loadSound, playSound } from './soundEngine.ts';

/** Sound files (`sound/<name>.*` in the pack or the shared art folder) for focus moves. */
export const SOUND_NAMES = { menu: 'move-menu', games: 'move-games' } as const;

const DEFAULT_SOUND = defaultSettings().themes.sound;

/** Settings → General → Theme sounds (D7), kept current when Settings change. */
function useHostSound(): ThemeSound {
  const host = useContext(ThemeHostContext);
  const [sound, setSound] = useState(() => host?.sound() ?? DEFAULT_SOUND);
  useEffect(
    () =>
      host?.onEvent((event) => {
        if (event.type === 'settings-changed') setSound(host.sound());
      }),
    [host],
  );
  return sound;
}

type Kind = 'menu' | 'games';

/** A stable label for the current level, for building a theme's `levelKey`. */
export function levelIdentity(level: Level | null | undefined): string {
  if (!level) return '';
  return level.kind === 'menu' ? `m:${level.node?.id ?? 'root'}` : `g:${level.node.id}`;
}

/** A negative numeric focus means nothing is focused yet. */
const isNoFocus = (key: string | number) => typeof key === 'number' && key < 0;

/**
 * Plays `move-menu` / `move-games` whenever focus moves within the current level. Silent on
 * mount, on a `levelKey` change (entering or leaving a level, a tab switch), on the render where
 * muting ends, and while `muted`. With no sound file anywhere it stays silent. Each new blip
 * stops the previous one of the same sound, so rapid moves restart it instead of layering. Theme
 * sounds off (or volume 0) in Settings keeps it silent; the volume follows Settings.
 */
export function useNavigationSound(opts: {
  focusKey: string | number;
  levelKey: string;
  levelKind: Level['kind'] | undefined;
  muted?: boolean;
}) {
  const { focusKey, levelKey, levelKind, muted = false } = opts;
  const art = useThemeArt();
  const sound = useHostSound();
  const silent = !sound.enabled || sound.volume === 0;
  const volume = sound.volume / 100;

  // Keyed by content, not identity, so equal candidate lists don't reload.
  const menuKey = art.sound(SOUND_NAMES.menu).join('\n');
  const gamesKey = art.sound(SOUND_NAMES.games).join('\n');

  const buffers = useRef<Record<Kind, AudioBuffer | null>>({ menu: null, games: null });
  const voices = useRef<Record<Kind, AudioBufferSourceNode | null>>({ menu: null, games: null });
  const prevFocus = useRef(focusKey);
  const prevLevel = useRef(levelKey);
  const prevMuted = useRef(muted);

  useEffect(() => {
    let alive = true;
    const list = (key: string) => (key ? key.split('\n') : []);
    void Promise.all([loadSound(list(menuKey)), loadSound(list(gamesKey))]).then(
      ([menu, games]) => {
        if (alive) buffers.current = { menu, games };
      },
    );
    return () => {
      alive = false;
      buffers.current = { menu: null, games: null };
    };
  }, [menuKey, gamesKey]);

  useEffect(() => {
    const levelChanged = prevLevel.current !== levelKey;
    const focusChanged = prevFocus.current !== focusKey;
    const mutedChanged = prevMuted.current !== muted;
    const unsettled = isNoFocus(prevFocus.current) || isNoFocus(focusKey);
    prevLevel.current = levelKey;
    prevFocus.current = focusKey;
    prevMuted.current = muted;

    if (muted || mutedChanged || levelChanged || unsettled || !focusChanged || !levelKind) return;
    if (silent) return;

    const kind: Kind = levelKind === 'games' ? 'games' : 'menu';
    const buffer = buffers.current[kind];
    if (!buffer) return;
    try {
      voices.current[kind]?.stop();
    } catch {
      // Already finished.
    }
    voices.current[kind] = playSound(buffer, volume);
  }, [focusKey, levelKey, levelKind, muted, silent, volume]);
}
