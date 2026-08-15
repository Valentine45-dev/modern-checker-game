// Sound effects for the checker game
export class SoundManager {
  private static instance: SoundManager;
  private audioContext: AudioContext | null = null;
  private isEnabled: boolean = true;
  private volume: number = 0.5;

  private constructor() {
    this.initializeAudioContext();
  }

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  private initializeAudioContext(): void {
    try {
      // Create audio context on first user interaction
      const AudioContextCtor =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      this.audioContext = AudioContextCtor ? new AudioContextCtor() : null;
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
      this.audioContext = null;
    }
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine'): void {
    if (!this.isEnabled || !this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
      oscillator.type = type;

      // Set volume with fade in/out
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(this.volume, this.audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (error) {
      console.warn('Failed to play sound:', error);
    }
  }

  private playChord(frequencies: number[], duration: number, type: OscillatorType = 'sine'): void {
    if (!this.isEnabled || !this.audioContext) return;

    try {
      frequencies.forEach(frequency => {
        const oscillator = this.audioContext!.createOscillator();
        const gainNode = this.audioContext!.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext!.destination);

        oscillator.frequency.setValueAtTime(frequency, this.audioContext!.currentTime);
        oscillator.type = type;

        // Set volume with fade in/out
        gainNode.gain.setValueAtTime(0, this.audioContext!.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, this.audioContext!.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext!.currentTime + duration);

        oscillator.start(this.audioContext!.currentTime);
        oscillator.stop(this.audioContext!.currentTime + duration);
      });
    } catch (error) {
      console.warn('Failed to play chord:', error);
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

  // Resume audio context on user interaction
  public resumeAudioContext(): void {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }
}

// Export singleton instance
export const soundManager = SoundManager.getInstance();
