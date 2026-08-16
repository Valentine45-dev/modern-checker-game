import { GameState, Piece, Position } from '../types';
import { getGameSettings, SETTINGS_KEY } from './gameSettings';

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

/**
 * Write the game to localStorage.
 *
 * Deliberately synchronous. This used to be async purely to `await import()`
 * the settings module, which made saving unordered with respect to
 * clearGameState: a save started before a game ended could resolve *after* the
 * clear and resurrect the finished game, so the menu would offer to resume a
 * game that was already over. There is no import cycle here, so a plain static
 * import removes the race entirely.
 */
export function saveGameState(
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
): void {
  try {
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

/**
 * Every localStorage key this app owns. localStorage is shared across the whole
 * origin, so anything not on this list belongs to somebody else and must be left
 * alone.
 */
export const OWNED_STORAGE_KEYS = [GAME_STATE_KEY, SETTINGS_KEY] as const;

/**
 * Clear the saved game, keeping user preferences.
 *
 * This used to scan localStorage and remove any key whose name merely contained
 * "game" or "checkers". On a shared origin — a personal site, a staging domain,
 * anything served from the same host — that would delete other applications'
 * data. It now removes exactly one key, the one this module wrote.
 */
export function clearAllGameData(): void {
  try {
    localStorage.removeItem(GAME_STATE_KEY);
  } catch (error) {
    console.error('Failed to clear game data:', error);
  }
}

/**
 * Clear everything this app stores, settings included.
 *
 * Note this is not `localStorage.clear()`, which would wipe the entire origin
 * rather than just this game's two keys.
 */
export function clearOwnedStorage(): void {
  for (const key of OWNED_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to remove ${key}:`, error);
    }
  }
}
