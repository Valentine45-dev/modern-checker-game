import { describe, it, expect } from 'vitest';
import {
  applyResult,
  emptyStats,
  parseStats,
  summarise,
  STATS_SCHEMA_VERSION,
  type GameStats,
} from '../gameStats';

describe('applyResult', () => {
  it('credits a win when the human wins an AI game', () => {
    const stats = applyResult(emptyStats(), {
      gameId: 1,
      mode: 'ai-hard',
      winner: 'black',
      humanColor: 'black',
    });

    expect(stats.ai['ai-hard']).toEqual({ played: 1, won: 1 });
  });

  it('counts a loss as played but not won', () => {
    const stats = applyResult(emptyStats(), {
      gameId: 1,
      mode: 'ai-hard',
      winner: 'red',
      humanColor: 'black',
    });

    expect(stats.ai['ai-hard']).toEqual({ played: 1, won: 0 });
  });

  it('counts a PvP game as played without attributing a win', () => {
    const stats = applyResult(emptyStats(), {
      gameId: 1,
      mode: 'pvp',
      winner: 'red',
      humanColor: null,
    });

    expect(stats.pvpPlayed).toBe(1);
    expect(summarise(stats).aiWon).toBe(0);
  });

  it('ignores a repeated game id', () => {
    // The recording effect can re-run — StrictMode double-invokes it in
    // development — and a game must still count exactly once.
    const result = { gameId: 7, mode: 'ai-easy', winner: 'black', humanColor: 'black' } as const;
    const once = applyResult(emptyStats(), result);
    const twice = applyResult(once, result);

    expect(twice.ai['ai-easy']).toEqual({ played: 1, won: 1 });
  });

  it('counts a genuinely new game after a rematch', () => {
    const first = applyResult(emptyStats(), {
      gameId: 1, mode: 'ai-easy', winner: 'black', humanColor: 'black',
    });
    const second = applyResult(first, {
      gameId: 2, mode: 'ai-easy', winner: 'red', humanColor: 'black',
    });

    expect(second.ai['ai-easy']).toEqual({ played: 2, won: 1 });
  });

  it('does not mutate the stats it was given', () => {
    const before = emptyStats();
    applyResult(before, { gameId: 1, mode: 'ai-medium', winner: 'black', humanColor: 'black' });

    expect(before.ai['ai-medium']).toEqual({ played: 0, won: 0 });
    expect(before.lastRecordedGameId).toBeNull();
  });
});

describe('summarise', () => {
  it('reports no win rate rather than 0% before any AI game', () => {
    // 0% would claim the player has lost every game, which is a different
    // statement from having no record at all.
    expect(summarise(emptyStats()).winRate).toBeNull();
  });

  it('excludes PvP games from the win rate but counts them as played', () => {
    let stats = applyResult(emptyStats(), {
      gameId: 1, mode: 'pvp', winner: 'red', humanColor: null,
    });
    stats = applyResult(stats, {
      gameId: 2, mode: 'ai-medium', winner: 'black', humanColor: 'black',
    });

    const summary = summarise(stats);
    expect(summary.gamesPlayed).toBe(2);
    expect(summary.aiPlayed).toBe(1);
    expect(summary.winRate).toBe(100);
  });

  it('rounds the win rate', () => {
    let stats = emptyStats();
    for (let i = 0; i < 3; i++) {
      stats = applyResult(stats, {
        gameId: i, mode: 'ai-easy', winner: i === 0 ? 'black' : 'red', humanColor: 'black',
      });
    }

    expect(summarise(stats).winRate).toBe(33);
  });
});

describe('parseStats', () => {
  it('returns empty stats for missing storage', () => {
    expect(parseStats(null)).toEqual(emptyStats());
  });

  it('returns empty stats for unparseable JSON', () => {
    expect(parseStats('{not json')).toEqual(emptyStats());
  });

  it('rejects a schema version it cannot interpret', () => {
    const future = JSON.stringify({ ...emptyStats(), schemaVersion: 99, pvpPlayed: 5 });
    expect(parseStats(future).pvpPlayed).toBe(0);
  });

  it('discards nonsense counts instead of rendering NaN', () => {
    const corrupt = JSON.stringify({
      schemaVersion: STATS_SCHEMA_VERSION,
      pvpPlayed: 'lots',
      ai: { 'ai-easy': { played: -4, won: null } },
      lastRecordedGameId: 'nope',
    });

    const stats = parseStats(corrupt);
    expect(stats.pvpPlayed).toBe(0);
    expect(stats.ai['ai-easy']).toEqual({ played: 0, won: 0 });
    expect(stats.lastRecordedGameId).toBeNull();
    expect(summarise(stats).winRate).toBeNull();
  });

  it('clamps wins that exceed games played', () => {
    // Otherwise a hand-edited file yields a win rate above 100%.
    const impossible: GameStats = {
      ...emptyStats(),
      ai: { ...emptyStats().ai, 'ai-hard': { played: 2, won: 9 } },
    };

    const stats = parseStats(JSON.stringify(impossible));
    expect(stats.ai['ai-hard']).toEqual({ played: 2, won: 2 });
    expect(summarise(stats).winRate).toBe(100);
  });

  it('round-trips a real record', () => {
    const stats = applyResult(emptyStats(), {
      gameId: 42, mode: 'ai-hard', winner: 'black', humanColor: 'black',
    });

    expect(parseStats(JSON.stringify(stats))).toEqual(stats);
  });
});
