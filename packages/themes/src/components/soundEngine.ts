// Ported from NextLevelOS src/themes/components/soundEngine.ts @ 3d530b7.

/**
 * Web Audio playback for short UI sounds. One AudioContext for the whole app stays running once
 * created: its continuous (silent) output keeps Bluetooth headphones and other power-saving
 * outputs awake, so a lone 50 ms blip is not swallowed while the device wakes up (as happens
 * with plain <audio>). Decoded files are cached by URL. Without Web Audio everything is a silent
 * no-op.
 */

let context: AudioContext | null = null;
const decoded = new Map<string, Promise<AudioBuffer | null>>();

/** Test hook: forget the context and every decoded file. */
export function resetSoundEngine(): void {
  context = null;
  decoded.clear();
}

/** The shared context, created on first use; null where Web Audio is missing. */
export function getAudioContext(): AudioContext | null {
  if (context) return context;
  const Ctor =
    typeof window !== 'undefined'
      ? (window.AudioContext as typeof AudioContext | undefined)
      : undefined;
  if (!Ctor) return null;
  context = new Ctor();
  return context;
}

async function decode(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await ctx.decodeAudioData(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** The first candidate that loads and decodes, or null. Each URL is read once. */
export async function loadSound(candidates: string[]): Promise<AudioBuffer | null> {
  if (candidates.length === 0) return null;
  const ctx = getAudioContext();
  if (!ctx) return null;
  for (const url of candidates) {
    let pending = decoded.get(url);
    if (!pending) {
      pending = decode(ctx, url);
      decoded.set(url, pending);
    }
    const buffer = await pending;
    if (buffer) return buffer;
  }
  return null;
}

/** Starts `buffer` at `volume`; returns the voice so the caller can stop it. */
export function playSound(buffer: AudioBuffer, volume: number): AudioBufferSourceNode | null {
  const ctx = getAudioContext();
  if (!ctx) return null;
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
  return source;
}
