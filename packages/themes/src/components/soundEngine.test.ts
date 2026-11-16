import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAudioContext, resetSoundEngine } from './soundEngine.ts';

interface Node {
  connectedTo: unknown;
}
const oscillators: FakeOscillator[] = [];
const gains: FakeGain[] = [];

class FakeOscillator implements Node {
  type = 'sine';
  frequency = { value: 440 };
  connectedTo: unknown = null;
  started = false;
  constructor() {
    oscillators.push(this);
  }
  connect(target: unknown) {
    this.connectedTo = target;
    return target;
  }
  start() {
    this.started = true;
  }
}
class FakeGain implements Node {
  gain = { value: 1 };
  connectedTo: unknown = null;
  constructor() {
    gains.push(this);
  }
  connect(target: unknown) {
    this.connectedTo = target;
    return target;
  }
}
class FakeAudioContext {
  state = 'running';
  destination = { kind: 'destination' };
  createOscillator() {
    return new FakeOscillator();
  }
  createGain() {
    return new FakeGain();
  }
}

beforeEach(() => {
  oscillators.length = 0;
  gains.length = 0;
  resetSoundEngine();
  vi.stubGlobal('AudioContext', FakeAudioContext);
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetSoundEngine();
});

describe('soundEngine keep-alive (FR-THM-1)', () => {
  it('keeps the output awake with an inaudible, moving signal so a blip after idle is heard', () => {
    const ctx = getAudioContext();
    expect(oscillators).toHaveLength(1);
    const [osc] = oscillators;
    const [gain] = gains;
    expect(osc?.started).toBe(true);
    expect(osc?.type).toBe('sine');
    expect(osc?.connectedTo).toBe(gain);
    expect(gain?.connectedTo).toBe(ctx?.destination);
    // Wireless/USB headsets sleep on a quiet stream and drop the next short blip. Measured on a
    // wireless headset (20 Hz): -66 dB let it sleep, -58 and -52 kept it awake unheard, -40 was
    // audible. Stay a few dB above -58 and well below -40.
    const db = 20 * Math.log10(gain?.gain.value ?? 0);
    expect(osc?.frequency.value).toBe(20);
    expect(db).toBeGreaterThanOrEqual(-55);
    expect(db).toBeLessThanOrEqual(-48);
  });

  it('starts the keep-alive once per context', () => {
    getAudioContext();
    getAudioContext();
    expect(oscillators).toHaveLength(1);
  });

  it('works without oscillator support', () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        destination = {};
      },
    );
    expect(getAudioContext()).not.toBeNull();
  });
});
