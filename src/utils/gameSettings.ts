export interface GameSettings {
  soundEnabled: boolean;
  soundVolume: number;
  animationsEnabled: boolean;
  darkMode: boolean;
  boardTheme: 'classic' | 'modern' | 'marble' | 'neon';
  pieceStyle: 'standard' | 'minimal' | 'detailed' | 'retro';
  autoSave: boolean;
  showMoveHints: boolean;
  showCaptures: boolean;
  aiDifficulty: 'easy' | 'medium' | 'hard';
  gameSpeed: 'slow' | 'normal' | 'fast';
}

const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  soundVolume: 0.5,
  animationsEnabled: true,
  darkMode: false,
  boardTheme: 'classic',
  pieceStyle: 'standard',
  autoSave: true,
  showMoveHints: true,
  showCaptures: true,
  aiDifficulty: 'medium',
  gameSpeed: 'normal'
};

const SETTINGS_KEY = 'checkers-game-settings';

export function getGameSettings(): GameSettings {
  try {
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error('Failed to load game settings:', error);
  }
  return DEFAULT_SETTINGS;
}

export function saveGameSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save game settings:', error);
  }
}

export function updateGameSetting<K extends keyof GameSettings>(
  key: K, 
  value: GameSettings[K]
): void {
  const currentSettings = getGameSettings();
  const updatedSettings = { ...currentSettings, [key]: value };
  saveGameSettings(updatedSettings);
}

export function resetGameSettings(): void {
  saveGameSettings(DEFAULT_SETTINGS);
}

// Game speed multipliers
export const GAME_SPEED_MULTIPLIERS = {
  slow: 1.5,
  normal: 1.0,
  fast: 0.5
};

/**
 * How long to pause before the AI's move appears.
 *
 * This used to also be scaled by the saved `aiDifficulty` setting, which was the
 * only thing that setting did — so a player who set Settings to Hard and then
 * started an Easy game got Easy, very slightly slower, while the UI implied the
 * AI had been made stronger. Difficulty comes from the game mode; this is purely
 * pacing.
 */
export function getAIThinkingTime(baseTime: number, speed: string): number {
  const speedMultiplier = GAME_SPEED_MULTIPLIERS[speed as keyof typeof GAME_SPEED_MULTIPLIERS] || 1.0;
  return Math.round(baseTime * speedMultiplier);
}

/** The game mode matching the saved default-difficulty preference. */
export function getDefaultAIGameMode(): 'ai-easy' | 'ai-medium' | 'ai-hard' {
  switch (getGameSettings().aiDifficulty) {
    case 'easy': return 'ai-easy';
    case 'hard': return 'ai-hard';
    default: return 'ai-medium';
  }
}

// Animation duration adjustments
export function getAnimationDuration(baseDuration: number, speed: string): number {
  const speedMultiplier = GAME_SPEED_MULTIPLIERS[speed as keyof typeof GAME_SPEED_MULTIPLIERS] || 1.0;
  return Math.round(baseDuration * speedMultiplier);
}

// Update sound settings
export function updateSoundSettings(enabled: boolean, volume: number): void {
  // Use dynamic import to avoid circular dependency issues
  import('./soundManager').then((module) => {
    const soundManager = module.soundManager;
    soundManager.setEnabled(enabled);
    soundManager.setVolume(volume);
  }).catch((error) => {
    console.warn('Failed to update sound settings:', error);
  });
}
