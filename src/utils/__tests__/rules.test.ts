import { describe, it, expect } from 'vitest';
import {
  enumerateMoves,
  applyMove,
  getPossibleCaptures,
  getAllValidMovesForPlayer,
  createInitialBoard,
  promotionRow,
  findWinner,
} from '../rules';
import { boardFrom, emptyBoard, put, countPieces, render } from './testUtils';

describe('board setup', () => {
  it('places 12 pieces per side on dark squares only', () => {
    const board = createInitialBoard();
    expect(countPieces(board, 'red')).toBe(12);
    expect(countPieces(board, 'black')).toBe(12);

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (board[row][col]) expect((row + col) % 2).toBe(1);
      }
    }
  });

  it('gives each side 7 opening moves', () => {
    const board = createInitialBoard();
    expect(enumerateMoves(board, 'red')).toHaveLength(7);
    expect(enumerateMoves(board, 'black')).toHaveLength(7);
  });
});

describe('mandatory capture', () => {
  it('suppresses every non-capturing move when a capture exists', () => {
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

    const moves = enumerateMoves(board, 'red');
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every(m => m.isCapture)).toBe(true);
  });
});

describe('capture sequences', () => {
  it('returns a double jump as ONE move that takes two pieces', () => {
    // This is the regression test for the bug that made deeper search worse:
    // the search used to treat the first hop as the whole move.
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

    const moves = enumerateMoves(board, 'red');
    const chain = moves.find(m => m.captured.length === 2);

    expect(chain, `expected a 2-capture chain in:\n${render(board)}`).toBeDefined();
    expect(chain!.path).toEqual([{ row: 4, col: 4 }, { row: 6, col: 6 }]);
    expect(chain!.to).toEqual({ row: 6, col: 6 });
  });

  it('applies every capture in the chain to the board', () => {
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

    const chain = enumerateMoves(board, 'red').find(m => m.captured.length === 2)!;
    const after = applyMove(board, chain);

    expect(countPieces(after, 'black')).toBe(1);
    expect(after[6][6]).not.toBeNull();
    expect(after[3][3]).toBeNull();
    expect(after[5][5]).toBeNull();
  });

  it('enumerates every branch when a chain forks', () => {
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

    const captureCounts = enumerateMoves(board, 'red')
      .map(m => m.captured.length)
      .sort();

    // more than one distinct branch, and at least one multi-capture
    expect(captureCounts.length).toBeGreaterThan(1);
    expect(Math.max(...captureCounts)).toBeGreaterThan(1);
  });

  it('never counts the same piece twice in one sequence', () => {
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

    for (const move of enumerateMoves(board, 'red')) {
      const ids = move.captured.map(p => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('promotion', () => {
  it('promotes a man that ends its move on the far rank', () => {
    const board = emptyBoard();
    put(board, 6, 2, 'red');
    put(board, 0, 0, 'black');

    const move = enumerateMoves(board, 'red').find(m => m.to.row === 7)!;
    expect(move.promotes).toBe(true);

    const after = applyMove(board, move);
    expect(after[move.to.row][move.to.col]!.type).toBe('king');
  });

  it('marks a move as promoting only when it FINISHES on the promotion row', () => {
    // `promotes` describes the whole turn, so it may only be true when the last
    // square of the path is the crowning row. Crossing that row mid-sequence
    // does not count — see promotionTiming.test.ts for the full rule.
    const board = boardFrom(`
      b . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . r . . . . . .
      . . b . . . b .
      . . . . . . . .
    `);

    const moves = enumerateMoves(board, 'red');
    const promoting = moves.filter(m => m.promotes);
    expect(promoting.length).toBeGreaterThan(0);

    for (const move of moves) {
      const endsOnRow = move.path[move.path.length - 1].row === promotionRow('red');
      expect(move.promotes).toBe(endsOnRow);
      expect(move.to.row === promotionRow('red')).toBe(endsOnRow);
    }
  });

  it('uses the opposite rank for black', () => {
    expect(promotionRow('red')).toBe(7);
    expect(promotionRow('black')).toBe(0);
  });
});

describe('kings', () => {
  it('lets a king slide any distance along a clear diagonal', () => {
    const board = emptyBoard();
    put(board, 3, 3, 'red', 'king');
    put(board, 0, 7, 'black');

    const destinations = enumerateMoves(board, 'red').map(m => `${m.to.row},${m.to.col}`);
    expect(destinations).toContain('7,7');
    expect(destinations).toContain('0,0');
  });

  it('stops a king at a blocking piece', () => {
    const board = emptyBoard();
    put(board, 3, 3, 'red', 'king');
    put(board, 5, 5, 'red');
    put(board, 0, 7, 'black');

    // Filter to the king's own moves: the blocking piece is a red man and has
    // moves of its own, which would otherwise pollute this assertion.
    const kingId = board[3][3]!.id;
    const destinations = enumerateMoves(board, 'red')
      .filter(m => m.pieceId === kingId)
      .map(m => `${m.to.row},${m.to.col}`);

    expect(destinations).toContain('4,4');
    expect(destinations).not.toContain('5,5'); // occupied
    expect(destinations).not.toContain('6,6'); // behind the blocker
  });
});

describe('men capture backwards', () => {
  it('allows a man to jump a piece behind it', () => {
    const board = emptyBoard();
    put(board, 4, 4, 'red');
    put(board, 3, 3, 'black'); // behind red, which moves down
    put(board, 7, 7, 'black');

    const captures = getPossibleCaptures(board[4][4]!, board);
    expect(captures.length).toBeGreaterThan(0);
    expect(captures.some(c => c.position.row === 2 && c.position.col === 2)).toBe(true);
  });
});

describe('win detection', () => {
  it('declares no winner while both sides can play', () => {
    const board = createInitialBoard();
    expect(findWinner(board, 'red')).toBeUndefined();
    expect(findWinner(board, 'black')).toBeUndefined();
  });

  it('awards the win when the side to move has no pieces', () => {
    const board = emptyBoard();
    put(board, 3, 3, 'red');

    expect(findWinner(board, 'black')).toBe('red');
  });

  it('awards the win when the side to move is blocked but still has pieces', () => {
    // Black's only man is cornered: its forward diagonal is occupied and the
    // square beyond is occupied too, so it can neither step nor jump.
    const board = emptyBoard();
    put(board, 7, 7, 'black');
    put(board, 6, 6, 'red');
    put(board, 5, 5, 'red');

    expect(countPieces(board, 'black')).toBe(1);
    expect(findWinner(board, 'black')).toBe('red');
  });

  it('asks about the player to move, not the player who just moved', () => {
    // This is the distinction the old check got wrong. Red is stuck; black is
    // not. Whoever is to move decides the result.
    const board = emptyBoard();
    put(board, 0, 0, 'red');
    put(board, 1, 1, 'black');
    put(board, 2, 2, 'black');
    put(board, 5, 5, 'black');

    expect(findWinner(board, 'red')).toBe('black');
    expect(findWinner(board, 'black')).toBeUndefined();
  });
});

describe('no legal moves', () => {
  it('reports an empty move list for a fully blocked side', () => {
    const board = emptyBoard();
    // Red's single man is cornered: its one forward diagonal is occupied, and
    // the square beyond it is occupied too, so it cannot move or jump.
    put(board, 0, 0, 'red');
    put(board, 1, 1, 'black');
    put(board, 2, 2, 'black');

    expect(enumerateMoves(board, 'red')).toHaveLength(0);
  });

  it('agrees with getAllValidMovesForPlayer', () => {
    const board = createInitialBoard();
    const legacy = getAllValidMovesForPlayer(board, 'red');
    const modern = enumerateMoves(board, 'red');

    const legacyCount = [...legacy.normalMoves.values()].reduce((n, m) => n + m.length, 0);
    expect(modern.length).toBe(legacyCount);
  });
});
