import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * A minimal Web Audio stand-in.
 *
 * `exponentialRampToValueAtTime` enforces the constraint the real API imposes —
 * it cannot start from zero — so reintroducing that bug fails a test instead of
 * producing silence nobody notices.
 */

let contextsConstructed = 0;
let oscillatorsCreated = 0;

class FakeAudioParam {
  events: Array<{ kind: string; value: number; time: number }> = [];

  private get lastValue(): number | null {
    const last = this.events[this.events.length - 1];
    return last ? last.value : null;
  }

  setValueAtTime(value: number, time: number) {
    this.events.push({ kind: 'set', value, time });
  }

  linearRampToValueAtTime(value: number, time: number) {
    this.events.push({ kind: 'linear', value, time });
  }

  exponentialRampToValueAtTime(value: number, time: number) {
    if (this.lastValue === 0) {
      throw new RangeError('exponential ramp cannot start from zero');
    }
    if (value <= 0) {
      throw new RangeError('exponential ramp cannot target zero');
    }
    this.events.push({ kind: 'exponential', value, time });
  }
}

class FakeOscillator {
  frequency = new FakeAudioParam();
  type = 'sine';
  connect() {}
  start() {}
  stop() {}
}

class FakeGain {
  gain = new FakeAudioParam();
  connect() {}
}

class FakeAudioContext {
  state: 'running' | 'suspended' = 'suspended';
  currentTime = 0;
  destination = {};

  constructor() {
    contextsConstructed++;
  }

  createOscillator() {
    oscillatorsCreated++;
    return new FakeOscillator();
  }

  createGain() {
    return new FakeGain();
  }

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

async function loadSoundManager() {
  const module = await import('../soundManager');
  return module.soundManager;
}

beforeEach(() => {
  contextsConstructed = 0;
  oscillatorsCreated = 0;
  vi.resetModules();
  vi.stubGlobal('window', { AudioContext: FakeAudioContext });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('audio context creation', () => {
  it('does not build an AudioContext at import time', async () => {
    // It used to. Browsers refuse to start one without a user gesture, so it
    // began suspended and warned on the console on every single page load.
    await loadSoundManager();
    expect(contextsConstructed).toBe(0);
  });

  it('builds one on the first user gesture', async () => {
    const soundManager = await loadSoundManager();
    soundManager.resumeAudioContext();
    expect(contextsConstructed).toBe(1);
  });

  it('builds one lazily if a sound plays before any gesture is reported', async () => {
    const soundManager = await loadSoundManager();
    soundManager.playMoveSound();
    expect(contextsConstructed).toBe(1);
  });

  it('reuses the same context across sounds', async () => {
    const soundManager = await loadSoundManager();
    soundManager.resumeAudioContext();
    soundManager.playMoveSound();
    soundManager.playCaptureSound();
    expect(contextsConstructed).toBe(1);
  });
});

describe('gain envelope', () => {
  it('plays nothing at zero volume', async () => {
    const soundManager = await loadSoundManager();
    soundManager.setVolume(0);
    soundManager.playMoveSound();

    // Not merely inaudible: scheduling it at all meant an exponential ramp from
    // a gain of zero, which is undefined behaviour.
    expect(oscillatorsCreated).toBe(0);
  });

  it('plays nothing when sound is disabled', async () => {
    const soundManager = await loadSoundManager();
    soundManager.setEnabled(false);
    soundManager.playMoveSound();
    expect(oscillatorsCreated).toBe(0);
  });

  it('schedules a valid envelope at ordinary volume', async () => {
    const soundManager = await loadSoundManager();
    soundManager.setVolume(0.5);
    // The fake throws on an invalid ramp, so reaching the assertion is the test.
    soundManager.playMoveSound();
    expect(oscillatorsCreated).toBe(1);
  });

  it('schedules a valid envelope at the lowest audible volume', async () => {
    const soundManager = await loadSoundManager();
    // Chords scale gain down by 0.3, which used to push the peak below the
    // fixed 0.001 decay floor and turn the decay into a swell.
    soundManager.setVolume(0.002);
    soundManager.playCaptureSound();
    expect(oscillatorsCreated).toBe(3);
  });

  it('gives every voice of a chord its own oscillator', async () => {
    const soundManager = await loadSoundManager();
    soundManager.setVolume(0.5);
    soundManager.playKingPromotionSound();
    expect(oscillatorsCreated).toBe(4);
  });
});

describe('unsupported browsers', () => {
  it('stays silent without throwing when Web Audio is missing', async () => {
    vi.stubGlobal('window', {});
    const soundManager = await loadSoundManager();

    expect(() => {
      soundManager.resumeAudioContext();
      soundManager.playMoveSound();
    }).not.toThrow();
    expect(oscillatorsCreated).toBe(0);
  });
});
