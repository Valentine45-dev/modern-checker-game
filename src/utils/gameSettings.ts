export interface GameSettings {
  soundEnabled: boolean;
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

// AI thinking time adjustments based on difficulty and speed
export function getAIThinkingTime(baseTime: number, difficulty: string, speed: string): number {
  const speedMultiplier = GAME_SPEED_MULTIPLIERS[speed as keyof typeof GAME_SPEED_MULTIPLIERS] || 1.0;
  const difficultyMultiplier = difficulty === 'easy' ? 0.7 : difficulty === 'hard' ? 1.3 : 1.0;
  return Math.round(baseTime * speedMultiplier * difficultyMultiplier);
}

// Animation duration adjustments
export function getAnimationDuration(baseDuration: number, speed: string): number {
  const speedMultiplier = GAME_SPEED_MULTIPLIERS[speed as keyof typeof GAME_SPEED_MULTIPLIERS] || 1.0;
  return Math.round(baseDuration * speedMultiplier);
}
