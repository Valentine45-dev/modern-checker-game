import { GameMode, PlayerColor } from '../types';

/**
 * Lifetime game statistics.
 *
 * Wins are tracked for AI games only. In PvP both sides are played on the same
 * device, so "you won" has no meaning there — recording those games as wins or
 * losses would make the win rate a number that answers no question. PvP games
 * still count towards games played.
 */

export const STATS_KEY = 'checkers-game-stats';
export const STATS_SCHEMA_VERSION = 1;

export type AIGameMode = Exclude<GameMode, 'pvp'>;

export const AI_MODES: AIGameMode[] = ['ai-easy', 'ai-medium', 'ai-hard'];

export interface ModeTally {
  played: number;
  won: number;
}

export interface GameStats {
  schemaVersion: number;
  /** Local two-player games. No winner is attributed. */
  pvpPlayed: number;
  ai: Record<AIGameMode, ModeTally>;
  /**
   * Identifies the last game written, so recording is idempotent. Effects can
   * re-run and React's StrictMode deliberately double-invokes them in
   * development; without this a single game counts two or three times.
   */
  lastRecordedGameId: number | null;
}

export function emptyStats(): GameStats {
  return {
    schemaVersion: STATS_SCHEMA_VERSION,
    pvpPlayed: 0,
    ai: {
      'ai-easy': { played: 0, won: 0 },
      'ai-medium': { played: 0, won: 0 },
      'ai-hard': { played: 0, won: 0 },
    },
    lastRecordedGameId: null,
  };
}

/** A non-negative integer, or 0 for anything else. */
function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

/**
 * Parse stored stats, falling back to empty for anything unusable.
 *
 * Pure, so it can be tested without touching localStorage. A tally that has been
 * corrupted or hand-edited should cost the player their history at worst — never
 * render `NaN%` or crash the settings page.
 */
export function parseStats(raw: string | null): GameStats {
  if (!raw) return emptyStats();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyStats();
  }

  if (!parsed || typeof parsed !== 'object') return emptyStats();
  const source = parsed as Partial<GameStats>;

  // A future version's shape is not something this build can interpret.
  if (source.schemaVersion !== STATS_SCHEMA_VERSION) return emptyStats();

  const stats = emptyStats();
  stats.pvpPlayed = count(source.pvpPlayed);

  for (const mode of AI_MODES) {
    const tally = source.ai?.[mode];
    const played = count(tally?.played);
    // Wins can never exceed games played; clamping keeps the rate within 0–100%.
    stats.ai[mode] = { played, won: Math.min(count(tally?.won), played) };
  }

  stats.lastRecordedGameId =
    typeof source.lastRecordedGameId === 'number' ? source.lastRecordedGameId : null;

  return stats;
}

export function getGameStats(): GameStats {
  try {
    return parseStats(localStorage.getItem(STATS_KEY));
  } catch (error) {
    console.error('Failed to read game statistics:', error);
    return emptyStats();
  }
}

export function saveGameStats(stats: GameStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (error) {
    console.error('Failed to save game statistics:', error);
  }
}

export interface GameResult {
  /** Unique per game; a repeat is ignored. */
  gameId: number;
  mode: GameMode;
  winner: PlayerColor;
  /** Which colour the person at the keyboard played. `null` in PvP. */
  humanColor: PlayerColor | null;
}

/**
 * Fold one finished game into the stats. Returns the new totals.
 *
 * Repeating a `gameId` is a no-op, so callers do not have to guarantee they fire
 * exactly once.
 */
export function applyResult(stats: GameStats, result: GameResult): GameStats {
  if (stats.lastRecordedGameId === result.gameId) return stats;

  const next: GameStats = {
    ...stats,
    ai: { ...stats.ai },
    lastRecordedGameId: result.gameId,
  };

  if (result.mode === 'pvp') {
    next.pvpPlayed = stats.pvpPlayed + 1;
    return next;
  }

  const mode = result.mode as AIGameMode;
  const tally = stats.ai[mode];
  next.ai[mode] = {
    played: tally.played + 1,
    won: tally.won + (result.humanColor && result.winner === result.humanColor ? 1 : 0),
  };
  return next;
}

export function recordGameResult(result: GameResult): GameStats {
  const updated = applyResult(getGameStats(), result);
  saveGameStats(updated);
  return updated;
}

export function resetGameStats(): void {
  saveGameStats(emptyStats());
}

export interface StatsSummary {
  gamesPlayed: number;
  aiPlayed: number;
  aiWon: number;
  /** `null` when no AI game has been finished — distinct from a rate of 0. */
  winRate: number | null;
}

export function summarise(stats: GameStats): StatsSummary {
  const aiPlayed = AI_MODES.reduce((sum, mode) => sum + stats.ai[mode].played, 0);
  const aiWon = AI_MODES.reduce((sum, mode) => sum + stats.ai[mode].won, 0);

  return {
    gamesPlayed: stats.pvpPlayed + aiPlayed,
    aiPlayed,
    aiWon,
    // Zero games is "no data", not "you lose every time". Showing 0% for a
    // player who has never finished a game is the placeholder bug all over again.
    winRate: aiPlayed === 0 ? null : Math.round((aiWon / aiPlayed) * 100),
  };
}
