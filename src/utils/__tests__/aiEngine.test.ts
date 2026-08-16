import { describe, it, expect, afterEach } from 'vitest';
import { calculateAIMove, AI_DIFFICULTIES, type AIDifficulty } from '../aiEngine';
import { enumerateMoves, applyMove, createInitialBoard } from '../rules';
import { Board as BoardType, PlayerColor } from '../../types';
import {
  boardFrom, emptyBoard, put, countPieces, render,
  bestCaptureCount, replyCostPerMove, fixRandom, seedRandom,
} from './testUtils';

/** A difficulty with no jitter and no deliberate blundering, for pure tests. */
const pure = (depth: number): AIDifficulty => ({
  depth, thinkingTime: 0, randomness: 0, blunderRate: 0,
});

let restore: (() => void) | null = null;
afterEach(() => { restore?.(); restore = null; });

/** Play one full game between two configs; returns the winner. */
function playGame(
  redCfg: AIDifficulty,
  blackCfg: AIDifficulty,
  maxPlies = 200
): { winner: PlayerColor | 'draw'; plies: number } {
  let board = createInitialBoard();
  let side: PlayerColor = 'black';
  let quietPlies = 0;

  for (let ply = 0; ply < maxPlies; ply++) {
    if (enumerateMoves(board, side).length === 0) {
      return { winner: side === 'red' ? 'black' : 'red', plies: ply };
    }

    const move = calculateAIMove(board, side, side === 'red' ? redCfg : blackCfg);
    if (!move) return { winner: side === 'red' ? 'black' : 'red', plies: ply };

    quietPlies = move.move.captured.length > 0 ? 0 : quietPlies + 1;
    board = applyMove(board, move.move);
    side = side === 'red' ? 'black' : 'red';

    if (countPieces(board, 'red') === 0) return { winner: 'black', plies: ply };
    if (countPieces(board, 'black') === 0) return { winner: 'red', plies: ply };
    if (quietPlies >= 60) return { winner: 'draw', plies: ply };
  }
  return { winner: 'draw', plies: maxPlies };
}

/** Score one config against another over N games, alternating colours. */
function matchScore(a: AIDifficulty, b: AIDifficulty, games: number): number {
  let points = 0;
  for (let g = 0; g < games; g++) {
    restore = seedRandom(1000 + g);
    const aIsRed = g % 2 === 0;
    const result = playGame(aIsRed ? a : b, aIsRed ? b : a);
    restore(); restore = null;

    if (result.winner === 'draw') points += 0.5;
    else if ((result.winner === 'red') === aIsRed) points += 1;
  }
  return points / games;
}

// ---------------------------------------------------------------------------

describe('difficulty configuration', () => {
  it('increases search depth as difficulty rises', () => {
    expect(AI_DIFFICULTIES['ai-easy'].depth)
      .toBeLessThan(AI_DIFFICULTIES['ai-medium'].depth);
    expect(AI_DIFFICULTIES['ai-medium'].depth)
      .toBeLessThan(AI_DIFFICULTIES['ai-hard'].depth);
  });

  it('reduces deliberate mistakes as difficulty rises', () => {
    expect(AI_DIFFICULTIES['ai-easy'].blunderRate)
      .toBeGreaterThan(AI_DIFFICULTIES['ai-medium'].blunderRate);
    expect(AI_DIFFICULTIES['ai-medium'].blunderRate)
      .toBeGreaterThanOrEqual(AI_DIFFICULTIES['ai-hard'].blunderRate);
    expect(AI_DIFFICULTIES['ai-hard'].blunderRate).toBe(0);
  });
});

describe('forced captures and multi-jumps', () => {
  it('always returns a capture when one is available', () => {
    restore = fixRandom();
    const board = boardFrom(`
      . . . . . . . .
      . . . . . . . .
      . . r . . . . .
      . . . b . . . .
      . . . . . . . .
      . r . . . . . .
      . . . . . . . .
      . . . . . . . b
    `);

    for (const name of ['ai-easy', 'ai-medium', 'ai-hard']) {
      const move = calculateAIMove(board, 'red', AI_DIFFICULTIES[name])!;
      expect(move.move.isCapture, `${name} skipped a mandatory capture`).toBe(true);
    }
  });

  it('executes a double jump as a single complete turn', () => {
    restore = fixRandom();
    const board = boardFrom(`
      r . . . . . . .
      . . . . . . . .
      . . r . . . . .
      . . . b . . . .
      . . . . . . . .
      . . . . . b . .
      . . . . . . . .
      . . . . . . . b
    `);

    const move = calculateAIMove(board, 'red', pure(4))!;
    expect(move.move.captured).toHaveLength(2);

    const after = applyMove(board, move.move);
    expect(countPieces(after, 'black'), `board after:\n${render(after)}`).toBe(1);
  });

  it('takes the longest chain available', () => {
    restore = fixRandom();
    const board = boardFrom(`
      . . . . . . . .
      . . . . . . . .
      . . r . . . . .
      . b . b . . . .
      . . . . . . . .
      . b . . . b . .
      . . . . . . . .
      . . . . . . . b
    `);

    const best = bestCaptureCount(board, 'red');
    expect(best).toBeGreaterThan(1);

    const move = calculateAIMove(board, 'red', pure(4))!;
    expect(move.move.captured.length).toBe(best);
  });
});

describe('threat handling', () => {
  it('does not hand the opponent more material than necessary', () => {
    restore = fixRandom();
    // Red must choose between a quiet move and one that walks into a jump.
    const board = boardFrom(`
      . . . . . . . .
      . . . . . r . .
      . . r . . . . .
      . . . r . . . .
      . . . . . . . .
      . . . b . . . .
      . . . . . . b .
      . b . . . . . .
    `);

    const options = replyCostPerMove(board, 'red', 'black');
    const bestCase = Math.min(...options.map(o => o.loses));
    const worstCase = Math.max(...options.map(o => o.loses));
    // only meaningful if the position actually discriminates
    expect(worstCase).toBeGreaterThan(bestCase);

    const move = calculateAIMove(board, 'red', AI_DIFFICULTIES['ai-hard'])!;
    const cost = bestCaptureCount(applyMove(board, move.move), 'black');
    expect(cost, `hard walked into a ${cost}-piece reply:\n${render(board)}`).toBe(bestCase);
  });

  it('prefers winning material when it is free to do so', () => {
    restore = fixRandom();
    const board = boardFrom(`
      . . . . . . . .
      . . . . . . . .
      . . r . . . . .
      . . . b . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . b .
      . . . . . . . .
    `);

    const move = calculateAIMove(board, 'red', AI_DIFFICULTIES['ai-hard'])!;
    expect(move.move.captured.length).toBeGreaterThan(0);
  });
});

describe('search depth actually buys strength', () => {
  it('never scores worse at a deeper depth against the same opponent', () => {
    // The guard that would have caught the original bug, where depth 4 and 5
    // lost every game that depth 2 won.
    const baseline = pure(2);
    const scores = [2, 4, 6].map(depth => matchScore(pure(depth), baseline, 4));

    // depth 2 vs itself is a wash; deeper must not be worse than that
    expect(scores[1]).toBeGreaterThanOrEqual(scores[0] - 0.01);
    expect(scores[2]).toBeGreaterThanOrEqual(scores[0] - 0.01);
  }, 120_000);

  it('has hard beating easy convincingly', () => {
    const score = matchScore(AI_DIFFICULTIES['ai-hard'], AI_DIFFICULTIES['ai-easy'], 6);
    expect(score, `hard scored only ${(score * 100).toFixed(0)}% against easy`)
      .toBeGreaterThan(0.8);
  }, 120_000);

  it('has hard at least matching medium', () => {
    const score = matchScore(AI_DIFFICULTIES['ai-hard'], AI_DIFFICULTIES['ai-medium'], 6);
    expect(score, `hard scored only ${(score * 100).toFixed(0)}% against medium`)
      .toBeGreaterThanOrEqual(0.5);
  }, 120_000);

  it('has easy losing to medium', () => {
    const score = matchScore(AI_DIFFICULTIES['ai-easy'], AI_DIFFICULTIES['ai-medium'], 6);
    expect(score, `easy scored ${(score * 100).toFixed(0)}% against medium`)
      .toBeLessThan(0.5);
  }, 120_000);
});

describe('responsiveness', () => {
  it('returns a hard move well inside a frame budget on a busy position', () => {
    restore = fixRandom();
    const board: BoardType = emptyBoard();
    put(board, 2, 0, 'red'); put(board, 2, 2, 'red'); put(board, 2, 4, 'red');
    put(board, 3, 5, 'red'); put(board, 1, 1, 'red'); put(board, 1, 3, 'red');
    put(board, 5, 1, 'black'); put(board, 5, 3, 'black'); put(board, 5, 5, 'black');
    put(board, 4, 6, 'black'); put(board, 6, 2, 'black'); put(board, 6, 4, 'black');

    const started = Date.now();
    const move = calculateAIMove(board, 'red', AI_DIFFICULTIES['ai-hard']);
    const elapsed = Date.now() - started;

    expect(move).not.toBeNull();
    // Generous: CI machines are slow. The point is to catch a regression that
    // makes the search pathological, not to benchmark.
    expect(elapsed, `hard took ${elapsed}ms`).toBeLessThan(2000);
  });

  it('never returns null when a legal move exists', () => {
    restore = fixRandom();
    const board = createInitialBoard();
    for (const name of Object.keys(AI_DIFFICULTIES)) {
      expect(calculateAIMove(board, 'red', AI_DIFFICULTIES[name])).not.toBeNull();
    }
  });

  it('returns null only when the side to move is stuck', () => {
    const board = emptyBoard();
    put(board, 0, 0, 'red');
    put(board, 1, 1, 'black');
    put(board, 2, 2, 'black');

    expect(calculateAIMove(board, 'red', pure(3))).toBeNull();
  });
});
