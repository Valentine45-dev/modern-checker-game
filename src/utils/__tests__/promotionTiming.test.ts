import { describe, it, expect } from 'vitest';
import {
  resolveCapturePath,
  captureDestinations,
  getAllValidMovesForPlayer,
  enumerateMoves,
  applyMove,
  promotionRow,
  type FullMove,
} from '../rules';
import { Piece, Position, Board as BoardType } from '../../types';
import { boardFrom, render } from './testUtils';

/**
 * Promotion belongs to the completed capture sequence, not to whichever square a
 * hop happens to land on.
 *
 * A man may pass *through* its promotion row mid-sequence. While the sequence is
 * unfinished it is still a man: it must keep its man's capture tree, and it must
 * only be crowned if the last landing square of the whole path is on the row.
 */

/**
 * Replays Game.tsx's executeCapture for one clicked destination.
 *
 * Deliberately mirrors the real order of operations: work out whether the
 * sequence is over FIRST, and only then decide about promotion. Deciding
 * promotion per-hop is the bug this file guards.
 */
function clickDestination(board: BoardType, piece: Piece, target: Position) {
  const captures = getAllValidMovesForPlayer(board, piece.color).captures.get(piece.id) ?? [];
  const resolved = resolveCapturePath(captures, target);
  if (!resolved) throw new Error(`no capture path to ${target.row},${target.col}`);

  const continuations = resolved.node.continuations;
  const sequenceEnds = resolved.endsTurn || !continuations || continuations.length === 0;
  const promotes =
    sequenceEnds && piece.type !== 'king' && target.row === promotionRow(piece.color);

  const next = board.map(row => [...row]);
  for (const captured of resolved.captured) {
    next[captured.position.row][captured.position.col] = null;
  }
  const movedPiece: Piece = {
    ...piece,
    position: target,
    type: promotes ? 'king' : piece.type,
  };
  next[piece.position.row][piece.position.col] = null;
  next[target.row][target.col] = movedPiece;

  return { board: next, movedPiece, promotes, sequenceEnds, captured: resolved.captured.length };
}

const at = (board: BoardType, row: number, col: number) => board[row][col]!;
const pos = (row: number, col: number): Position => ({ row, col });

/**
 * A red man on (5,0) with a chain that crosses its promotion row (row 7) twice:
 *
 *   (5,0) x(6,1) -> (7,2)   promotion row, but captures remain
 *         x(6,3) -> (5,4)
 *         x(6,5) -> (7,6)   promotion row again, and this time the end
 *
 * Every square used is a real dark square, so the same layout can be replayed in
 * the browser.
 */
function crossesPromotionRow(): BoardType {
  return boardFrom(`
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    r . . . . . . .
    . b . b . b . .
    . . . . . . . .
  `);
}

/** The same chain with the last victim removed, so it must stop on (5,4). */
function endsOffPromotionRow(): BoardType {
  return boardFrom(`
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    r . . . . . . .
    . b . b . . . .
    . . . . . . . .
  `);
}

describe('promotion timing: single capture', () => {
  it('promotes a man whose only capture ends on the promotion row', () => {
    const board = boardFrom(`
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      r . . . . . . .
      . b . . . . . .
      . . . . . . . .
    `);
    const piece = at(board, 5, 0);

    const result = clickDestination(board, piece, pos(7, 2));

    expect(result.sequenceEnds).toBe(true);
    expect(result.promotes).toBe(true);
    expect(at(result.board, 7, 2).type).toBe('king');
  });
});

describe('promotion timing: mid-sequence landing on the promotion row', () => {
  it('does not crown the piece on an intermediate promotion-row landing', () => {
    const board = crossesPromotionRow();
    const piece = at(board, 5, 0);

    const step = clickDestination(board, piece, pos(7, 2));

    expect(step.sequenceEnds).toBe(false);
    expect(step.promotes).toBe(false);
    expect(at(step.board, 7, 2).type).toBe('normal');
  });

  it('still offers the rest of the chain from a promotion-row landing', () => {
    const board = crossesPromotionRow();
    const piece = at(board, 5, 0);
    const captures = getAllValidMovesForPlayer(board, 'red').captures.get(piece.id) ?? [];

    const destinations = captureDestinations(captures);
    const asKeys = destinations.map(d => `${d.row},${d.col}`);

    // The intermediate landing and everything past it must be reachable.
    expect(asKeys).toContain('7,2');
    expect(asKeys).toContain('5,4');
    expect(asKeys).toContain('7,6');
  });

  it('keeps a man\'s capture tree after landing on the promotion row', () => {
    // A king here would fly, so it could reach squares a man cannot. Landing on
    // the promotion row must not hand out king movement mid-sequence.
    const board = crossesPromotionRow();
    const piece = at(board, 5, 0);
    const step = clickDestination(board, piece, pos(7, 2));

    const onward = getAllValidMovesForPlayer(step.board, 'red')
      .captures.get(step.movedPiece.id) ?? [];
    const landings = onward.flatMap(node => [node.position, ...(node.continuations ?? []).map(c => c.position)]);

    expect(at(step.board, 7, 2).type).toBe('normal');
    // Exactly the man's jump: over (6,3) to (5,4). No flying-king landings.
    expect(landings.some(l => l.row === 5 && l.col === 4)).toBe(true);
    expect(landings.every(l => Math.abs(l.row - 7) <= 2)).toBe(true);
  });
});

describe('promotion timing: where the sequence finishes decides', () => {
  it('leaves the piece a man when the path ends off the promotion row', () => {
    const board = endsOffPromotionRow();

    const move = enumerateMoves(board, 'red').find(m => m.captured.length === 2);
    expect(move, render(board)).toBeDefined();
    expect(move!.to).toEqual(pos(5, 4));
    expect(move!.promotes).toBe(false);

    const after = applyMove(board, move!);
    expect(at(after, 5, 4).type).toBe('normal');
  });

  it('crowns the piece only once the final capture lands on the row', () => {
    const board = crossesPromotionRow();

    const move = enumerateMoves(board, 'red').find(m => m.captured.length === 3);
    expect(move, render(board)).toBeDefined();
    expect(move!.to).toEqual(pos(7, 6));
    expect(move!.promotes).toBe(true);
    // The path went through the promotion row on the way.
    expect(move!.path.some(p => p.row === promotionRow('red') && p.col === 2)).toBe(true);

    const after = applyMove(board, move!);
    expect(at(after, 7, 6).type).toBe('king');
  });

  it('does not truncate the sequence at the promotion row', () => {
    // Before the fix the engine emitted a 1-capture move ending on (7,2) and
    // nothing longer, because it treated that landing as the end of the turn.
    const board = crossesPromotionRow();
    const longest = Math.max(...enumerateMoves(board, 'red').map(m => m.captured.length));
    expect(longest).toBe(3);
  });
});

describe('promotion timing: human and engine agree', () => {
  /** Walk a FullMove hop by hop the way a player clicking each square would. */
  function playStepByStep(board: BoardType, move: FullMove): BoardType {
    let current = board;
    let piece = current[move.from.row][move.from.col]!;
    for (const hop of move.path) {
      const step = clickDestination(current, piece, hop);
      current = step.board;
      piece = step.movedPiece;
    }
    return current;
  }

  it('step-by-step clicking matches selecting the final destination', () => {
    const board = crossesPromotionRow();
    const move = enumerateMoves(board, 'red').find(m => m.captured.length === 3)!;

    const stepwise = playStepByStep(board, move);
    const direct = clickDestination(board, at(board, 5, 0), pos(7, 6)).board;

    expect(render(stepwise)).toBe(render(direct));
    expect(at(stepwise, 7, 6).type).toBe('king');
  });

  it('the engine simulation matches the human click path', () => {
    for (const board of [crossesPromotionRow(), endsOffPromotionRow()]) {
      const move = enumerateMoves(board, 'red')
        .reduce((a, b) => (b.captured.length > a.captured.length ? b : a));

      const engine = applyMove(board, move);
      const human = playStepByStep(board, move);

      expect(render(human)).toBe(render(engine));
    }
  });
});

describe('promotion timing: king behaviour is untouched', () => {
  it('a king crossing its promotion row stays a king and keeps flying', () => {
    const board = boardFrom(`
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      R . . . . . . .
      . b . b . . . .
      . . . . . . . .
    `);
    const king = at(board, 5, 0);

    const move = enumerateMoves(board, 'red')
      .reduce((a, b) => (b.captured.length > a.captured.length ? b : a));

    expect(king.type).toBe('king');
    expect(move.promotes).toBe(false);
    expect(move.captured.length).toBe(2);
    expect(at(applyMove(board, move), move.to.row, move.to.col).type).toBe('king');
  });
});
