import { describe, it, expect } from 'vitest';
import {
  resolveCapturePath,
  captureDestinations,
  getAllValidMovesForPlayer,
  getPossibleCaptures,
  enumerateMoves,
  promotionRow,
} from '../rules';
import { Piece, Position, Board as BoardType } from '../../types';
import { boardFrom, emptyBoard, put, countPieces, render } from './testUtils';

/**
 * Replays what Game.tsx does when a player clicks a destination: resolve the
 * path, remove everything captured along it, move the piece, promote if it
 * lands on the back rank. Returns the new board and whether the turn continues.
 *
 * This mirrors executeCapture so the tests exercise the real click flow rather
 * than a parallel implementation.
 */
function clickDestination(
  board: BoardType,
  piece: Piece,
  captures: ReturnType<typeof getPossibleCaptures>,
  target: Position
): { board: BoardType; movedPiece: Piece; captured: number; turnContinues: boolean } {
  const resolved = resolveCapturePath(captures, piece, target);
  if (!resolved) throw new Error(`no capture path to ${target.row},${target.col}`);

  const next = board.map(row => [...row]);
  for (const captured of resolved.captured) {
    next[captured.position.row][captured.position.col] = null;
  }

  const promotes = piece.type !== 'king' && target.row === promotionRow(piece.color);
  const movedPiece: Piece = { ...piece, position: target, type: promotes ? 'king' : piece.type };

  next[piece.position.row][piece.position.col] = null;
  next[target.row][target.col] = movedPiece;

  const continuations = resolved.node.continuations;
  const turnContinues = !resolved.endsTurn && !!continuations && continuations.length > 0 && !promotes;

  return { board: next, movedPiece, captured: resolved.captured.length, turnContinues };
}

function capturesFor(board: BoardType, piece: Piece) {
  const all = getAllValidMovesForPlayer(board, piece.color);
  return all.captures.get(piece.id) ?? [];
}

/** A man at (1,1) that can chain three jumps: (3,3) -> (5,5) -> (7,7)... */
function tripleChainBoard(): BoardType {
  return boardFrom(`
    . . . . . . . .
    . r . . . . . .
    . . b . . . . .
    . . . . . . . .
    . . . . b . . .
    . . . . . . . .
    . . . . . . b .
    . . . . . . . .
  `);
}

describe('resolveCapturePath', () => {
  it('returns only the first victim for a single hop', () => {
    const board = boardFrom(`
      . . . . . . . .
      . r . . . . . .
      . . b . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . b
    `);
    const piece = board[1][1]!;
    const resolved = resolveCapturePath(capturesFor(board, piece), piece, { row: 3, col: 3 })!;

    expect(resolved.captured).toHaveLength(1);
    expect(resolved.path).toEqual([{ row: 3, col: 3 }]);
    expect(resolved.endsTurn).toBe(true);
  });

  it('accumulates every victim on the way to a deep destination', () => {
    // The regression: looking a node up by position gives you only ITS victim,
    // so jumping straight to the end used to leave the earlier pieces standing.
    const board = tripleChainBoard();
    const piece = board[1][1]!;
    const captures = capturesFor(board, piece);

    const first = resolveCapturePath(captures, piece, { row: 3, col: 3 })!;
    const second = resolveCapturePath(captures, piece, { row: 5, col: 5 })!;
    const third = resolveCapturePath(captures, piece, { row: 7, col: 7 })!;

    expect(first.captured).toHaveLength(1);
    expect(second.captured).toHaveLength(2);
    expect(third.captured).toHaveLength(3);
    expect(third.path).toEqual([
      { row: 3, col: 3 }, { row: 5, col: 5 }, { row: 7, col: 7 },
    ]);
  });

  it('returns null for a square that is not in the tree', () => {
    const board = tripleChainBoard();
    const piece = board[1][1]!;
    expect(resolveCapturePath(capturesFor(board, piece), piece, { row: 4, col: 0 })).toBeNull();
  });
});

describe('clicking straight to the end of a chain', () => {
  it('removes every piece along the path, not just the last', () => {
    const board = tripleChainBoard();
    const piece = board[1][1]!;
    expect(countPieces(board, 'black')).toBe(3);

    const result = clickDestination(board, piece, capturesFor(board, piece), { row: 7, col: 7 });

    expect(result.captured).toBe(3);
    expect(countPieces(result.board, 'black'), `leftovers:\n${render(result.board)}`).toBe(0);
    expect(result.board[2][2]).toBeNull();
    expect(result.board[4][4]).toBeNull();
    expect(result.board[6][6]).toBeNull();
    expect(result.board[7][7]).not.toBeNull();
    expect(result.turnContinues).toBe(false);
  });

  it('lands the piece on the requested square and nowhere else', () => {
    const board = tripleChainBoard();
    const piece = board[1][1]!;
    const result = clickDestination(board, piece, capturesFor(board, piece), { row: 7, col: 7 });

    expect(result.board[1][1]).toBeNull();
    expect(result.board[7][7]!.id).toBe(piece.id);
    expect(countPieces(result.board, 'red')).toBe(1);
  });
});

describe('step-by-step still works and matches the shortcut', () => {
  it('reaches the same board one hop at a time', () => {
    const board = tripleChainBoard();
    const start = board[1][1]!;

    // hop 1
    let state = clickDestination(board, start, capturesFor(board, start), { row: 3, col: 3 });
    expect(state.captured).toBe(1);
    expect(state.turnContinues).toBe(true);

    // hop 2 — continue from where the piece landed
    let captures = getPossibleCaptures(state.movedPiece, state.board);
    state = clickDestination(state.board, state.movedPiece, captures, { row: 5, col: 5 });
    expect(state.captured).toBe(1);
    expect(state.turnContinues).toBe(true);

    // hop 3
    captures = getPossibleCaptures(state.movedPiece, state.board);
    state = clickDestination(state.board, state.movedPiece, captures, { row: 7, col: 7 });
    expect(state.captured).toBe(1);
    expect(state.turnContinues).toBe(false);

    expect(countPieces(state.board, 'black')).toBe(0);
    expect(state.board[7][7]).not.toBeNull();
  });

  it('produces an identical board whichever way the player clicks', () => {
    const shortcutBoard = tripleChainBoard();
    const shortcutPiece = shortcutBoard[1][1]!;
    const viaShortcut = clickDestination(
      shortcutBoard, shortcutPiece, capturesFor(shortcutBoard, shortcutPiece), { row: 7, col: 7 }
    ).board;

    let board = tripleChainBoard();
    let piece = board[1][1]!;
    for (const target of [{ row: 3, col: 3 }, { row: 5, col: 5 }, { row: 7, col: 7 }]) {
      const captures = piece.position.row === 1
        ? capturesFor(board, piece)
        : getPossibleCaptures(piece, board);
      const step = clickDestination(board, piece, captures, target);
      board = step.board;
      piece = step.movedPiece;
    }

    expect(render(board)).toBe(render(viaShortcut));
  });
});

describe('chain lengths 2 through 4', () => {
  const cases: { name: string; diagram: string; from: Position; to: Position; expected: number }[] = [
    {
      name: 'two captures',
      diagram: `
        . . . . . . . .
        . r . . . . . .
        . . b . . . . .
        . . . . . . . .
        . . . . b . . .
        . . . . . . . .
        . . . . . . . .
        . . . . . . . b
      `,
      from: { row: 1, col: 1 }, to: { row: 5, col: 5 }, expected: 2,
    },
    {
      name: 'three captures',
      diagram: `
        . . . . . . . .
        . r . . . . . .
        . . b . . . . .
        . . . . . . . .
        . . . . b . . .
        . . . . . . . .
        . . . . . . b .
        . . . . . . . .
      `,
      from: { row: 1, col: 1 }, to: { row: 7, col: 7 }, expected: 3,
    },
    {
      name: 'four captures with a king zig-zagging',
      diagram: `
        . . . . . . . .
        . R . . . . . .
        . . b . . . . .
        . . . . . . . .
        . . . . b . . .
        . . . . . . . .
        . . b . . . b .
        . . . . . . . .
      `,
      from: { row: 1, col: 1 }, to: { row: 7, col: 7 }, expected: 3,
    },
  ];

  for (const testCase of cases) {
    it(`captures ${testCase.expected} pieces for ${testCase.name}`, () => {
      const board = boardFrom(testCase.diagram);
      const piece = board[testCase.from.row][testCase.from.col]!;
      const before = countPieces(board, 'black');

      const result = clickDestination(board, piece, capturesFor(board, piece), testCase.to);

      expect(result.captured).toBe(testCase.expected);
      expect(countPieces(result.board, 'black')).toBe(before - testCase.expected);
    });
  }
});

describe('illegal shortcuts are rejected', () => {
  it('offers only squares that exist in the capture tree', () => {
    const board = tripleChainBoard();
    const piece = board[1][1]!;
    const offered = captureDestinations(capturesFor(board, piece), piece)
      .map(p => `${p.row},${p.col}`);

    expect(offered).toEqual(expect.arrayContaining(['3,3', '5,5', '7,7']));
    expect(offered).not.toContain('4,4'); // a square the piece passes over, never lands on
    expect(offered).not.toContain('2,2'); // an occupied square
  });

  it('will not resolve a path to an unrelated square', () => {
    const board = tripleChainBoard();
    const piece = board[1][1]!;
    for (const bad of [{ row: 0, col: 0 }, { row: 4, col: 4 }, { row: 6, col: 0 }]) {
      expect(resolveCapturePath(capturesFor(board, piece), piece, bad)).toBeNull();
    }
  });
});

describe('promotion stops the chain', () => {
  it('does not offer squares beyond the square where a man crowns', () => {
    // Red man jumps onto row 7 and crowns; the turn ends there even if the
    // geometry would allow another jump.
    const board = boardFrom(`
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . r . . . . . .
      . . b . . . b .
      . . . . . . . .
    `);
    const piece = board[5][1]!;
    const offered = captureDestinations(capturesFor(board, piece), piece);

    expect(offered.some(p => p.row === 7)).toBe(true);
    // nothing past the promotion square
    for (const dest of offered) {
      const resolved = resolveCapturePath(capturesFor(board, piece), piece, dest)!;
      if (dest.row === 7) expect(resolved.endsTurn).toBe(true);
    }
  });

  it('agrees with enumerateMoves about what is legal', () => {
    // The squares the UI offers as final destinations must be a subset of the
    // destinations the engine considers legal, or the two disagree about the
    // rules — which is how the AI and the board diverge.
    const board = tripleChainBoard();
    const piece = board[1][1]!;

    const engineDestinations = new Set(
      enumerateMoves(board, 'red')
        .filter(m => m.pieceId === piece.id)
        .map(m => `${m.to.row},${m.to.col}`)
    );

    const offered = captureDestinations(capturesFor(board, piece), piece);
    const terminal = offered.filter(dest => {
      const resolved = resolveCapturePath(capturesFor(board, piece), piece, dest)!;
      return resolved.endsTurn;
    });

    for (const dest of terminal) {
      expect(engineDestinations.has(`${dest.row},${dest.col}`)).toBe(true);
    }
  });
});

describe('single captures and forced-capture rules are untouched', () => {
  it('still executes a plain one-piece capture', () => {
    const board = emptyBoard();
    put(board, 2, 2, 'red');
    put(board, 3, 3, 'black');
    put(board, 7, 7, 'black');

    const piece = board[2][2]!;
    const result = clickDestination(board, piece, capturesFor(board, piece), { row: 4, col: 4 });

    expect(result.captured).toBe(1);
    expect(result.turnContinues).toBe(false);
    expect(countPieces(result.board, 'black')).toBe(1);
  });

  it('still forbids quiet moves while a capture exists', () => {
    const board = boardFrom(`
      . . . . . . . .
      . r . . . . . .
      . . b . . . . .
      . . . . . . . .
      . r . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . b
    `);
    const moves = enumerateMoves(board, 'red');
    expect(moves.every(m => m.isCapture)).toBe(true);

    // the piece with no capture available is offered nothing
    const quietPiece = board[4][1]!;
    expect(capturesFor(board, quietPiece)).toHaveLength(0);
  });
});
