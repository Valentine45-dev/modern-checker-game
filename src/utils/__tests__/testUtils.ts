import { Piece, PlayerColor, Board as BoardType } from '../../types';
import { enumerateMoves, applyMove, type FullMove } from '../rules';

/** An empty 8x8 board. */
export function emptyBoard(): BoardType {
  return Array(8).fill(null).map(() => Array(8).fill(null));
}

let uid = 0;

/** Place a piece. Returns the board so calls can be chained in a test. */
export function put(
  board: BoardType,
  row: number,
  col: number,
  color: PlayerColor,
  type: 'normal' | 'king' = 'normal'
): BoardType {
  board[row][col] = { id: `${color}-${++uid}`, color, type, position: { row, col } };
  return board;
}

/**
 * Build a board from an ASCII diagram. Row 0 is the top, which is where red
 * starts, so red moves down the diagram and black moves up.
 *
 *   r = red man,  R = red king,  b = black man,  B = black king,  . = empty
 */
export function boardFrom(diagram: string): BoardType {
  const board = emptyBoard();
  const rows = diagram.trim().split('\n').map(r => r.trim().split(/\s+/));

  rows.forEach((cells, row) => {
    cells.forEach((cell, col) => {
      if (cell === 'r') put(board, row, col, 'red', 'normal');
      else if (cell === 'R') put(board, row, col, 'red', 'king');
      else if (cell === 'b') put(board, row, col, 'black', 'normal');
      else if (cell === 'B') put(board, row, col, 'black', 'king');
    });
  });

  return board;
}

/** Render a board back to the diagram format, for readable assertion failures. */
export function render(board: BoardType): string {
  return board
    .map(row => row.map(p => {
      if (!p) return '.';
      if (p.color === 'red') return p.type === 'king' ? 'R' : 'r';
      return p.type === 'king' ? 'B' : 'b';
    }).join(' '))
    .join('\n');
}

export function countPieces(board: BoardType, color: PlayerColor): number {
  let n = 0;
  for (const row of board) for (const sq of row) if (sq && sq.color === color) n++;
  return n;
}

export function allPieces(board: BoardType): Piece[] {
  const out: Piece[] = [];
  for (const row of board) for (const sq of row) if (sq) out.push(sq);
  return out;
}

/** The most pieces `player` can win in a single turn from this position. */
export function bestCaptureCount(board: BoardType, player: PlayerColor): number {
  let best = 0;
  for (const move of enumerateMoves(board, player)) {
    if (move.captured.length > best) best = move.captured.length;
  }
  return best;
}

/**
 * For each legal move `player` has, how many pieces the opponent could win in
 * reply. Used to tell a blunder apart from a forced loss: if every move hands
 * over the same amount, the position simply isn't discriminating.
 */
export function replyCostPerMove(
  board: BoardType,
  player: PlayerColor,
  opponent: PlayerColor
): { move: FullMove; loses: number }[] {
  return enumerateMoves(board, player).map(move => ({
    move,
    loses: bestCaptureCount(applyMove(board, move), opponent),
  }));
}

/** Deterministic Math.random, so tests never flake on the AI's jitter. */
export function seedRandom(seed: number): () => void {
  const original = Math.random;
  let a = seed;
  Math.random = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => { Math.random = original; };
}

/** Pin Math.random to a constant, removing jitter entirely. */
export function fixRandom(value = 0.5): () => void {
  const original = Math.random;
  Math.random = () => value;
  return () => { Math.random = original; };
}
