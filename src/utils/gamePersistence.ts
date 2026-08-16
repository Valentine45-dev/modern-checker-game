import { GameState, Piece, Position } from '../types';

const GAME_STATE_KEY = 'checkers-game-state';

export interface SavedGameState extends GameState {
  turnNumber: number;
  gameStartTime: number;
  kingsPromoted: { red: number; black: number };
  multiJumpInProgress: boolean;
  currentJumpPiece: Piece | null;
  accumulatedCaptures: Piece[];
  chainOrigin: Position | null;
  aiThinking: boolean;
  piecesWithCaptures: string[];
  // Visual settings
  boardTheme: string;
  pieceStyle: string;
}

export async function saveGameState(
  gameState: GameState,
  turnNumber: number,
  gameStartTime: number,
  kingsPromoted: { red: number; black: number },
  multiJumpInProgress: boolean,
  currentJumpPiece: Piece | null,
  accumulatedCaptures: Piece[],
  chainOrigin: Position | null,
  aiThinking: boolean,
  piecesWithCaptures: Set<string>
): Promise<void> {
  try {
    // Get current visual settings
    const { getGameSettings } = await import('./gameSettings');
    const settings = getGameSettings();
    
    const savedState: SavedGameState = {
      ...gameState,
      turnNumber,
      gameStartTime,
      kingsPromoted,
      multiJumpInProgress,
      currentJumpPiece,
      accumulatedCaptures,
      chainOrigin,
      aiThinking,
      piecesWithCaptures: Array.from(piecesWithCaptures),
      // Include visual settings
      boardTheme: settings.boardTheme,
      pieceStyle: settings.pieceStyle
    };

    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(savedState));
  } catch (error) {
    console.error('Failed to save game state:', error);
  }
}

export function loadGameState(): SavedGameState | null {
  try {
    const saved = localStorage.getItem(GAME_STATE_KEY);
    if (!saved) return null;

    const parsed = JSON.parse(saved) as SavedGameState;
    
    // Validate the loaded state has required properties
    if (!parsed.board || !parsed.currentPlayer || !parsed.gameMode) {
      console.warn('Invalid saved game state, clearing...');
      clearGameState();
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('Failed to load game state:', error);
    clearGameState();
    return null;
  }
}

export function clearGameState(): void {
  try {
    localStorage.removeItem(GAME_STATE_KEY);
  } catch (error) {
    console.error('Failed to clear game state:', error);
  }
}

export function hasGameInProgress(): boolean {
  try {
    const saved = localStorage.getItem(GAME_STATE_KEY);
    if (!saved) return false;

    const parsed = JSON.parse(saved);
    return parsed.gameStatus === 'playing';
  } catch (error) {
    console.error('Failed to check for saved game:', error);
    return false;
  }
}

export function getSavedGameMode(): string | null {
  try {
    const saved = localStorage.getItem(GAME_STATE_KEY);
    if (!saved) return null;

    const parsed = JSON.parse(saved);
    return parsed.gameMode || null;
  } catch (error) {
    console.error('Failed to get saved game mode:', error);
    return null;
  }
}

export function clearAllGameData(): void {
  try {
    // Clear the main game state
    localStorage.removeItem(GAME_STATE_KEY);
    
    // Clear any other potential game-related data (but preserve settings)
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('checkers') || key.includes('game'))) {
        // Don't remove settings - preserve user preferences
        if (key !== 'checkers-game-settings') {
          keysToRemove.push(key);
        }
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    console.log('All game data cleared from localStorage (settings preserved)');
  } catch (error) {
    console.error('Failed to clear all game data:', error);
  }
}
