// Sound effects for the checker game
import { envelopeFor } from './audioEnvelope';

/** Chords would be `voices` times louder than a single tone at the same gain. */
const CHORD_VOICE_SCALE = 0.3;

export class SoundManager {
  private static instance: SoundManager;
  private audioContext: AudioContext | null = null;
  /** Set once the Web Audio API has proved unavailable, so we stop retrying. */
  private audioUnavailable = false;
  private isEnabled: boolean = true;
  private volume: number = 0.5;

  private constructor() {}

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  /**
   * The audio context, created on first use.
   *
   * It used to be constructed when this module was imported — before the page
   * had even rendered, let alone been clicked. Browsers refuse to start an
   * AudioContext without a user gesture, so it was born `suspended` and every
   * load printed a console warning about it. Creating it lazily means the first
   * caller is always something the user did.
   */
  private getContext(): AudioContext | null {
    if (this.audioContext || this.audioUnavailable) return this.audioContext;

    try {
      const AudioContextCtor =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextCtor) {
        this.audioUnavailable = true;
        return null;
      }

      this.audioContext = new AudioContextCtor();
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
      this.audioUnavailable = true;
      this.audioContext = null;
    }

    return this.audioContext;
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Schedule one oscillator with an attack/decay envelope.
   *
   * Shared by tones and chords, which carried identical copies of this and so
   * carried identical copies of the zero-volume bug.
   */
  private scheduleVoice(
    context: AudioContext,
    frequency: number,
    duration: number,
    type: OscillatorType,
    peak: number,
    decayTarget: number
  ): void {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    const startAt = context.currentTime;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0, startAt);
    gainNode.gain.linearRampToValueAtTime(peak, startAt + 0.01);
    // Exponential ramps are undefined from a value of zero, and ramping *up* to
    // a fixed 0.001 floor at low volumes clicked instead of decaying. Both are
    // handled by envelopeFor, which guarantees 0 < decayTarget < peak.
    gainNode.gain.exponentialRampToValueAtTime(decayTarget, startAt + duration);

    oscillator.start(startAt);
    oscillator.stop(startAt + duration);
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine'): void {
    this.playVoices([frequency], duration, type, this.volume);
  }

  private playChord(frequencies: number[], duration: number, type: OscillatorType = 'sine'): void {
    this.playVoices(frequencies, duration, type, this.volume * CHORD_VOICE_SCALE);
  }

  private playVoices(
    frequencies: number[],
    duration: number,
    type: OscillatorType,
    requestedGain: number
  ): void {
    if (!this.isEnabled) return;

    const envelope = envelopeFor(requestedGain);
    // Silent: nothing to hear, and nothing to schedule.
    if (!envelope) return;

    const context = this.getContext();
    if (!context) return;

    // A context can be suspended long after it was created — switching tabs is
    // enough — so resuming only on the first interaction is not sufficient.
    if (context.state === 'suspended') {
      void context.resume().catch(() => { /* stays silent; not worth surfacing */ });
    }

    try {
      for (const frequency of frequencies) {
        this.scheduleVoice(context, frequency, duration, type, envelope.peak, envelope.decayTarget);
      }
    } catch (error) {
      console.warn('Failed to play sound:', error);
    }
  }

  // Game sound effects
  public playMoveSound(): void {
    this.playTone(440, 0.1, 'sine'); // A4 note
  }

  public playCaptureSound(): void {
    this.playChord([440, 554, 659], 0.2, 'square'); // A-C-E chord
  }

  public playKingPromotionSound(): void {
    this.playChord([523, 659, 784, 1047], 0.4, 'triangle'); // C-E-G-C chord (ascending)
  }

  public playInvalidMoveSound(): void {
    this.playTone(200, 0.3, 'sawtooth'); // Low, harsh sound
  }

  public playGameStartSound(): void {
    this.playChord([523, 659, 784], 0.5, 'sine'); // C-E-G chord
  }

  public playGameEndSound(): void {
    this.playChord([784, 659, 523], 0.6, 'sine'); // G-E-C chord (descending)
  }

  public playButtonClickSound(): void {
    this.playTone(800, 0.05, 'square');
  }

  public playNotificationSound(): void {
    this.playTone(660, 0.15, 'sine'); // E5 note
  }

  public playMultiJumpSound(): void {
    this.playChord([440, 523, 659], 0.25, 'triangle'); // A-C-E chord
  }

  public playAIMoveSound(): void {
    this.playTone(330, 0.2, 'sine'); // E4 note
  }

  /**
   * Called from the first click or keypress on the page.
   *
   * This is now also where the context gets created. Doing it here rather than
   * at import is the whole point: a gesture has definitely happened, so the
   * browser permits it and it does not start out suspended.
   */
  public resumeAudioContext(): void {
    const context = this.getContext();
    if (context?.state === 'suspended') {
      void context.resume().catch(() => { /* audio stays silent; not fatal */ });
    }
  }
}

// Export singleton instance
export const soundManager = SoundManager.getInstance();
