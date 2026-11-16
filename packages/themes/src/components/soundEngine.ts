// Ported from NextLevelOS src/themes/components/soundEngine.ts @ 3d530b7.

/**
 * Web Audio playback for short UI sounds. One AudioContext for the whole app stays running once
 * created, with a continuous keep-alive signal so Bluetooth headphones and other power-saving
 * outputs stay awake and a lone 50 ms blip is not swallowed while the device wakes up (as happens
 * with plain <audio>). Decoded files are cached by URL. Without Web Audio everything is a silent
 * no-op.
 */

/**
 * Keep-alive tone: a 20 Hz sine at -52 dBFS. Wireless/USB headsets and Bluetooth/HDMI outputs
 * power down after a few seconds of quiet and swallow (or fade in) the next 50 ms blip while they
 * wake up. Measured on a wireless USB headset: -66 dB let it sleep, -58 and -52 kept it awake
 * without being heard, -40 was an audible rumble. -52 leaves margin on both sides.
 */
const KEEP_ALIVE_HZ = 20;
const KEEP_ALIVE_LEVEL = 10 ** (-52 / 20);

function startKeepAlive(ctx: AudioContext): void {
  if (typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') return;
  const tone = ctx.createOscillator();
  tone.type = 'sine';
  tone.frequency.value = KEEP_ALIVE_HZ;
  const level = ctx.createGain();
  level.gain.value = KEEP_ALIVE_LEVEL;
  tone.connect(level);
  level.connect(ctx.destination);
  tone.start();
}

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
  startKeepAlive(context);
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
