import { Piece, Position, PlayerColor, Board as BoardType, PossibleMove } from '../types';

/**
 * The rules of the game, in one place.
 *
 * This logic previously existed twice — once inside Game.tsx and once copied
 * into aiEngine.ts (its own header said "copied from Game.tsx logic"). Two
 * copies meant the board could enforce one set of rules while the AI searched
 * with another. Both now import from here.
 */

export const DIRECTIONS: [number, number][] = [
  [-1, -1], [-1, 1], [1, -1], [1, 1]
];

export function isValidPosition(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

export function positionsEqual(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

/** Which row a piece of this colour promotes on. */
export function promotionRow(color: PlayerColor): number {
  return color === 'red' ? 7 : 0;
}

export function opponentOf(color: PlayerColor): PlayerColor {
  return color === 'red' ? 'black' : 'red';
}

// ============================================
// BOARD SETUP
// ============================================

export function createInitialBoard(): BoardType {
  const board: BoardType = Array(8).fill(null).map(() => Array(8).fill(null));

  let pieceId = 1;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        board[row][col] = { id: `red-${pieceId++}`, color: 'red', type: 'normal', position: { row, col } };
      }
    }
  }

  pieceId = 1;
  for (let row = 5; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        board[row][col] = { id: `black-${pieceId++}`, color: 'black', type: 'normal', position: { row, col } };
      }
    }
  }

  return board;
}

export function findPieceById(board: BoardType, id: string): Piece | null {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.id === id) return piece;
    }
  }
  return null;
}

export function countPieces(board: BoardType, color: PlayerColor): number {
  let n = 0;
  for (const row of board) for (const square of row) if (square && square.color === color) n++;
  return n;
}

// ============================================
// FLYING KING MOVEMENT
// ============================================

/** Every empty square a king can slide to in one direction. */
export function getFlyingKingSquares(
  piece: Piece,
  board: BoardType,
  direction: [number, number]
): Position[] {
  const squares: Position[] = [];
  const [dRow, dCol] = direction;
  let { row, col } = piece.position;

  for (;;) {
    row += dRow;
    col += dCol;

    if (!isValidPosition(row, col)) break;
    if (board[row][col]) break; // blocked

    squares.push({ row, col });
  }

  return squares;
}

/** The first enemy in a direction, plus every square the king could land on beyond it. */
export function getFlyingKingCaptures(
  piece: Piece,
  board: BoardType,
  direction: [number, number],
  capturedSoFar: Piece[] = []
): { landingSquares: Position[]; capturedPiece: Piece | null; capturePos: Position | null } {
  const [dRow, dCol] = direction;
  let { row, col } = piece.position;
  let enemyPiece: Piece | null = null;
  let capturePos: Position | null = null;

  for (;;) {
    row += dRow;
    col += dCol;

    if (!isValidPosition(row, col)) break;

    const square = board[row][col];
    if (square) {
      if (square.color !== piece.color && !capturedSoFar.some(p => p.id === square.id)) {
        enemyPiece = square;
        capturePos = { row, col };
      }
      break;
    }
  }

  const landingSquares: Position[] = [];
  if (enemyPiece && capturePos) {
    row = capturePos.row;
    col = capturePos.col;

    for (;;) {
      row += dRow;
      col += dCol;

      if (!isValidPosition(row, col)) break;
      if (board[row][col]) break;

      landingSquares.push({ row, col });
    }
  }

  return { landingSquares, capturedPiece: enemyPiece, capturePos };
}

// ============================================
// MOVE GENERATION
// ============================================

/**
 * The capture tree for one piece. Each node is a single hop; further hops of
 * the same sequence hang off `continuations`.
 */
export function getPossibleCaptures(
  piece: Piece,
  board: BoardType,
  capturedSoFar: Piece[] = [],
  currentPos?: Position
): PossibleMove[] {
  const pos = currentPos || piece.position;
  const captures: PossibleMove[] = [];

  if (piece.type === 'king') {
    for (const direction of DIRECTIONS) {
      const { landingSquares, capturedPiece, capturePos } = getFlyingKingCaptures(
        { ...piece, position: pos },
        board,
        direction,
        capturedSoFar
      );

      if (capturedPiece && capturePos) {
        for (const landing of landingSquares) {
          const tempBoard = board.map(row => [...row]);
          tempBoard[pos.row][pos.col] = null;
          tempBoard[capturePos.row][capturePos.col] = null;
          tempBoard[landing.row][landing.col] = { ...piece, position: landing };

          const continuations = getPossibleCaptures(
            { ...piece, position: landing },
            tempBoard,
            [...capturedSoFar, capturedPiece],
            landing
          );

          captures.push({
            position: landing,
            isCapture: true,
            capturedPieces: [capturedPiece],
            continuations: continuations.length > 0 ? continuations : undefined
          });
        }
      }
    }
  } else {
    // Normal pieces capture forwards AND backwards (international rule)
    for (const [dRow, dCol] of DIRECTIONS) {
      const jumpRow = pos.row + dRow * 2;
      const jumpCol = pos.col + dCol * 2;
      const midRow = pos.row + dRow;
      const midCol = pos.col + dCol;

      if (isValidPosition(jumpRow, jumpCol) && isValidPosition(midRow, midCol)) {
        const middlePiece = board[midRow][midCol];
        const jumpSquare = board[jumpRow][jumpCol];

        if (middlePiece &&
            middlePiece.color !== piece.color &&
            !jumpSquare &&
            !capturedSoFar.some(p => p.id === middlePiece.id)) {

          const tempBoard = board.map(row => [...row]);
          tempBoard[pos.row][pos.col] = null;
          tempBoard[midRow][midCol] = null;
          tempBoard[jumpRow][jumpCol] = { ...piece, position: { row: jumpRow, col: jumpCol } };

          const continuations = getPossibleCaptures(
            { ...piece, position: { row: jumpRow, col: jumpCol } },
            tempBoard,
            [...capturedSoFar, middlePiece],
            { row: jumpRow, col: jumpCol }
          );

          captures.push({
            position: { row: jumpRow, col: jumpCol },
            isCapture: true,
            capturedPieces: [middlePiece],
            continuations: continuations.length > 0 ? continuations : undefined
          });
        }
      }
    }
  }

  return captures;
}

export function getNormalMoves(piece: Piece, board: BoardType): Position[] {
  const moves: Position[] = [];
  const { row, col } = piece.position;

  if (piece.type === 'king') {
    for (const direction of DIRECTIONS) {
      moves.push(...getFlyingKingSquares(piece, board, direction));
    }
  } else {
    const forwardDir = piece.color === 'red' ? 1 : -1;

    for (const dCol of [-1, 1]) {
      const newRow = row + forwardDir;
      const newCol = col + dCol;

      if (isValidPosition(newRow, newCol) && !board[newRow][newCol]) {
        moves.push({ row: newRow, col: newCol });
      }
    }
  }

  return moves;
}

/**
 * Every legal option for a player, with the mandatory-capture rule applied:
 * if any capture exists, normal moves are not generated at all.
 */
export function getAllValidMovesForPlayer(board: BoardType, player: PlayerColor): {
  captures: Map<string, PossibleMove[]>;
  normalMoves: Map<string, Position[]>;
  mustCapture: boolean;
} {
  const captures = new Map<string, PossibleMove[]>();
  const normalMoves = new Map<string, Position[]>();

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === player) {
        const possibleCaptures = getPossibleCaptures(piece, board);
        if (possibleCaptures.length > 0) captures.set(piece.id, possibleCaptures);
      }
    }
  }

  const mustCapture = captures.size > 0;

  if (!mustCapture) {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.color === player) {
          const moves = getNormalMoves(piece, board);
          if (moves.length > 0) normalMoves.set(piece.id, moves);
        }
      }
    }
  }

  return { captures, normalMoves, mustCapture };
}

export function hasAnyMove(board: BoardType, player: PlayerColor): boolean {
  const { captures, normalMoves } = getAllValidMovesForPlayer(board, player);
  return captures.size > 0 || normalMoves.size > 0;
}

// ============================================
// CAPTURE TREE NAVIGATION
// ============================================

/** Every landing square in a capture tree, including continuations. */
export function flattenCaptureMoves(captures: PossibleMove[]): Position[] {
  const positions: Position[] = [];

  for (const capture of captures) {
    positions.push(capture.position);
    if (capture.continuations && capture.continuations.length > 0) {
      positions.push(...flattenCaptureMoves(capture.continuations));
    }
  }

  return positions;
}

/** Locate the node in a capture tree that lands on `targetPos`. */
export function findCaptureInTree(captures: PossibleMove[], targetPos: Position): PossibleMove | null {
  for (const capture of captures) {
    if (positionsEqual(capture.position, targetPos)) return capture;
    if (capture.continuations) {
      const found = findCaptureInTree(capture.continuations, targetPos);
      if (found) return found;
    }
  }
  return null;
}

// ============================================
// APPLYING A MOVE
// ============================================

/**
 * Produce the board that results from moving `piece` to `newPosition`, removing
 * `capturedPieces` and promoting if the destination is the back rank.
 */
export function simulateMove(
  board: BoardType,
  piece: Piece,
  newPosition: Position,
  capturedPieces: Piece[]
): BoardType {
  const newBoard = board.map(row => [...row]);

  for (const captured of capturedPieces) {
    newBoard[captured.position.row][captured.position.col] = null;
  }

  const promotes = piece.type !== 'king' && newPosition.row === promotionRow(piece.color);
  const movedPiece: Piece = {
    ...piece,
    position: newPosition,
    type: promotes ? 'king' : piece.type
  };

  newBoard[piece.position.row][piece.position.col] = null;
  newBoard[newPosition.row][newPosition.col] = movedPiece;

  return newBoard;
}
