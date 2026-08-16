import { GameState, Piece, Position } from '../types';
import { getGameSettings, SETTINGS_KEY } from './gameSettings';
import { STATS_KEY } from './gameStats';

const GAME_STATE_KEY = 'checkers-game-state';

/**
 * Bump whenever the saved shape changes in a way an older or newer build cannot
 * read. A save whose version does not match exactly is discarded rather than
 * guessed at.
 *
 * There is no migration path on purpose: the only thing at stake is a single
 * game in progress, and silently restoring a half-understood board is worse
 * than starting a new one. Settings live under a different key and are not
 * affected.
 *
 * History: the shape gained `chainOrigin`, then fractional clocks, then
 * `timerEnabled` in settings — all before this field existed, which is why
 * anything unversioned is treated as unreadable.
 */
export const SAVE_SCHEMA_VERSION = 1;

export interface SavedGameState extends GameState {
  schemaVersion: number;
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

const PLAYER_COLORS = ['red', 'black'];
const GAME_MODES = ['pvp', 'ai-easy', 'ai-medium', 'ai-hard'];
const GAME_STATUSES = ['menu', 'playing', 'paused', 'finished'];

function isPiece(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const piece = value as Record<string, unknown>;
  const position = piece.position as Record<string, unknown> | undefined;

  return (
    typeof piece.id === 'string' &&
    PLAYER_COLORS.includes(piece.color as string) &&
    (piece.type === 'normal' || piece.type === 'king') &&
    typeof position === 'object' && position !== null &&
    typeof position.row === 'number' &&
    typeof position.col === 'number'
  );
}

function isBoard(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== 8) return false;
  return value.every(
    row => Array.isArray(row) && row.length === 8 && row.every(cell => cell === null || isPiece(cell))
  );
}

/**
 * Parse a stored save, returning null if it is missing, corrupt, from another
 * schema version, or structurally wrong.
 *
 * Kept pure and separate from localStorage so the validation can be tested
 * directly. The previous version only checked that `board`, `currentPlayer` and
 * `gameMode` were truthy, so a truncated or hand-edited board sailed through and
 * crashed the game on render.
 */
export function parseSavedGame(raw: string | null): SavedGameState | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const save = parsed as Record<string, unknown>;

  if (save.schemaVersion !== SAVE_SCHEMA_VERSION) return null;
  if (!isBoard(save.board)) return null;
  if (!PLAYER_COLORS.includes(save.currentPlayer as string)) return null;
  if (!GAME_MODES.includes(save.gameMode as string)) return null;
  if (!GAME_STATUSES.includes(save.gameStatus as string)) return null;
  if (!Array.isArray(save.moveHistory)) return null;

  const score = save.score as Record<string, unknown> | undefined;
  if (typeof score !== 'object' || score === null) return null;
  if (typeof score.red !== 'number' || typeof score.black !== 'number') return null;

  return save as unknown as SavedGameState;
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
      schemaVersion: SAVE_SCHEMA_VERSION,
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

/**
 * Read the stored save, removing it if it cannot be read.
 *
 * Every caller goes through here so an unreadable save is pruned once rather
 * than lingering in storage forever because the only code path that cleaned it
 * up happened to be the one nobody hit.
 */
function readStoredGame(): SavedGameState | null {
  try {
    const raw = localStorage.getItem(GAME_STATE_KEY);
    if (raw === null) return null;

    const parsed = parseSavedGame(raw);
    if (!parsed) {
      clearGameState();
      return null;
    }
    return parsed;
  } catch (error) {
    console.error('Failed to read saved game:', error);
    clearGameState();
    return null;
  }
}

export function loadGameState(): SavedGameState | null {
  return readStoredGame();
}

export function clearGameState(): void {
  try {
    localStorage.removeItem(GAME_STATE_KEY);
  } catch (error) {
    console.error('Failed to clear game state:', error);
  }
}

export function hasGameInProgress(): boolean {
  return readStoredGame()?.gameStatus === 'playing';
}

export function getSavedGameMode(): string | null {
  return readStoredGame()?.gameMode ?? null;
}

/**
 * Every localStorage key this app owns. localStorage is shared across the whole
 * origin, so anything not on this list belongs to somebody else and must be left
 * alone.
 */
export const OWNED_STORAGE_KEYS = [GAME_STATE_KEY, SETTINGS_KEY, STATS_KEY] as const;

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
