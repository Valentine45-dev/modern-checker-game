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

const FILES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/** Board coordinate for a square, e.g. "C5". Used by the move list and by
 *  screen-reader labels, so both describe the board the same way. */
export function squareName(row: number, col: number): string {
  return `${FILES[col] ?? '?'}${8 - row}`;
}

/** Only dark squares are playable in checkers. */
export function isPlayableSquare(row: number, col: number): boolean {
  return (row + col) % 2 === 1;
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

/**
 * A destination inside a capture tree, resolved together with everything the
 * piece takes on the way there.
 */
export interface ResolvedCapturePath {
  /** The tree node that lands on the requested square. */
  node: PossibleMove;
  /** Landing squares from the current position to the target, in order. */
  path: Position[];
  /** EVERY piece captured along that path, not just at the final hop. */
  captured: Piece[];
  /** True when the sequence must stop here: no continuations, or a man promoted. */
  endsTurn: boolean;
}

/**
 * Resolve a clicked destination to its complete path through the capture tree.
 *
 * This exists because a capture tree node only knows about its OWN hop. Looking
 * a node up by position and then acting on `node.capturedPieces` moves the piece
 * the whole way while removing only the last victim, leaving the intermediate
 * pieces standing on an illegal board. Anything that resolves a destination must
 * go through here so it gets the cumulative captures.
 *
 * A man that lands on its promotion row ends its turn, so nothing beyond such a
 * landing is reachable — the same rule `enumerateMoves` applies, which keeps the
 * squares the UI offers identical to the ones the engine considers legal.
 */
export function resolveCapturePath(
  captures: PossibleMove[],
  piece: Piece,
  target: Position
): ResolvedCapturePath | null {
  const search = (
    nodes: PossibleMove[],
    pathSoFar: Position[],
    capturedSoFar: Piece[]
  ): ResolvedCapturePath | null => {
    for (const node of nodes) {
      const path = [...pathSoFar, node.position];
      const captured = [...capturedSoFar, ...node.capturedPieces];

      const promotesHere =
        piece.type !== 'king' && node.position.row === promotionRow(piece.color);
      const canContinue =
        !promotesHere && !!node.continuations && node.continuations.length > 0;

      if (positionsEqual(node.position, target)) {
        return { node, path, captured, endsTurn: !canContinue };
      }

      if (canContinue) {
        const deeper = search(node.continuations!, path, captured);
        if (deeper) return deeper;
      }
    }
    return null;
  };

  return search(captures, [], []);
}

/**
 * Every square a piece may legally finish a hop on, given a capture tree.
 * Intermediate landings stay selectable so a player can still take a sequence
 * one jump at a time; squares beyond a promotion are excluded because the turn
 * ends there.
 */
export function captureDestinations(captures: PossibleMove[], piece: Piece): Position[] {
  const out: Position[] = [];

  const walk = (nodes: PossibleMove[]) => {
    for (const node of nodes) {
      out.push(node.position);

      const promotesHere =
        piece.type !== 'king' && node.position.row === promotionRow(piece.color);

      if (!promotesHere && node.continuations && node.continuations.length > 0) {
        walk(node.continuations);
      }
    }
  };

  walk(captures);
  return out;
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
// COMPLETE MOVES
// ============================================

/**
 * A whole turn, not a single hop.
 *
 * `getPossibleCaptures` returns a tree whose top-level nodes are only the FIRST
 * jump of a sequence. Treating those nodes as "a move" — which the AI used to do
 * — means a triple capture is scored, and simulated, as though it wins one
 * piece, leaving the other two enemy pieces standing on an illegal board. Every
 * extra ply of search compounded that error, which is why searching deeper made
 * the AI play worse.
 *
 * A FullMove is a terminal leaf: the complete hop path and every piece it takes.
 */
export interface FullMove {
  pieceId: string;
  from: Position;
  /** Final landing square. */
  to: Position;
  /** Landing square of each hop, in order. Length 1 for a normal move. */
  path: Position[];
  /** Every piece captured across the whole sequence. */
  captured: Piece[];
  isCapture: boolean;
  /** True if this move ends with a man reaching its promotion row. */
  promotes: boolean;
}

/**
 * Walk a capture tree to its terminal leaves.
 *
 * A sequence stops early when a man lands on its promotion row, because that is
 * what the board does (Game.tsx ends the turn on promotion rather than letting a
 * fresh king keep jumping). The search has to model the same game the board
 * plays.
 */
function collectCaptureSequences(
  node: PossibleMove,
  piece: Piece,
  pathSoFar: Position[],
  capturedSoFar: Piece[],
  out: FullMove[]
): void {
  const path = [...pathSoFar, node.position];
  const captured = [...capturedSoFar, ...node.capturedPieces];

  const promotesHere = piece.type !== 'king' && node.position.row === promotionRow(piece.color);
  const canContinue = !promotesHere && node.continuations && node.continuations.length > 0;

  if (canContinue) {
    for (const child of node.continuations!) {
      collectCaptureSequences(child, piece, path, captured, out);
    }
    return;
  }

  out.push({
    pieceId: piece.id,
    from: piece.position,
    to: node.position,
    path,
    captured,
    isCapture: true,
    promotes: promotesHere,
  });
}

/**
 * Every legal complete turn for a player, with mandatory capture applied.
 * This is the primitive the search should use.
 */
export function enumerateMoves(board: BoardType, player: PlayerColor): FullMove[] {
  const moves: FullMove[] = [];
  const { captures, normalMoves } = getAllValidMovesForPlayer(board, player);

  for (const [pieceId, trees] of captures) {
    const piece = findPieceById(board, pieceId);
    if (!piece) continue;
    for (const tree of trees) {
      collectCaptureSequences(tree, piece, [], [], moves);
    }
  }

  if (captures.size === 0) {
    for (const [pieceId, positions] of normalMoves) {
      const piece = findPieceById(board, pieceId);
      if (!piece) continue;
      for (const to of positions) {
        moves.push({
          pieceId,
          from: piece.position,
          to,
          path: [to],
          captured: [],
          isCapture: false,
          promotes: piece.type !== 'king' && to.row === promotionRow(piece.color),
        });
      }
    }
  }

  return moves;
}

/** Apply a complete move: remove everything it captured, move, promote. */
export function applyMove(board: BoardType, move: FullMove): BoardType {
  const piece = board[move.from.row][move.from.col];
  if (!piece) return board.map(row => [...row]);
  return simulateMove(board, piece, move.to, move.captured);
}

/** How many pieces the opponent can win in a single reply. Used by tests. */
export function bestCaptureCountFor(board: BoardType, player: PlayerColor): number {
  let worst = 0;
  for (const move of enumerateMoves(board, player)) {
    if (move.captured.length > worst) worst = move.captured.length;
  }
  return worst;
}

// ============================================
// POSITION HASHING
// ============================================

/**
 * Zobrist keys: one random 32-bit value per (square, colour, rank), plus one
 * for "black to move". Generated once at module load with a fixed seed so runs
 * are reproducible.
 *
 * Two 32-bit halves are combined into a string key rather than using BigInt,
 * because this sits in the search's hot path and BigInt allocation would cost
 * more than the table saves.
 */
const ZOBRIST = (() => {
  let seed = 0x9e3779b9;
  const rand = () => {
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5; seed >>>= 0;
    return seed >>> 0;
  };

  // [square][pieceKind] where pieceKind is 0..3 for red/black man/king
  const squares: number[][][] = [];
  for (let i = 0; i < 64; i++) {
    squares.push([[rand(), rand()], [rand(), rand()], [rand(), rand()], [rand(), rand()]]);
  }
  return { squares, blackToMove: [rand(), rand()] as [number, number] };
})();

function pieceKind(piece: Piece): number {
  const colourOffset = piece.color === 'red' ? 0 : 2;
  return colourOffset + (piece.type === 'king' ? 1 : 0);
}

/** A key identifying this exact position with this side to move. */
export function hashPosition(board: BoardType, sideToMove: PlayerColor): string {
  let hi = 0;
  let lo = 0;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      const keys = ZOBRIST.squares[row * 8 + col][pieceKind(piece)];
      hi ^= keys[0];
      lo ^= keys[1];
    }
  }

  if (sideToMove === 'black') {
    hi ^= ZOBRIST.blackToMove[0];
    lo ^= ZOBRIST.blackToMove[1];
  }

  return `${hi >>> 0}:${lo >>> 0}`;
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
