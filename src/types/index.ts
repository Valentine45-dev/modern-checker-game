// ============================================
// CORE TYPES
// ============================================

export type PieceType = 'normal' | 'king';
export type PlayerColor = 'red' | 'black';
export type GameMode = 'pvp' | 'ai-easy' | 'ai-medium' | 'ai-hard';
export type GameStatus = 'menu' | 'playing' | 'paused' | 'finished';

// ============================================
// POSITION & BOARD
// ============================================

export interface Position {
  row: number;
  col: number;
}

export type BoardSquare = Piece | null;
export type Board = BoardSquare[][];

// ============================================
// PIECE
// ============================================

export interface Piece {
  id: string;
  color: PlayerColor;
  type: PieceType;
  position: Position;
}

// ============================================
// MOVE & CAPTURE
// ============================================

/** A completed turn, as recorded in the move history. */
export interface Move {
  /** Where the sequence began — not the last hop, for a multi-jump. */
  from: Position;
  to: Position;
  /** Every piece taken, across the whole sequence. */
  capturedPieces?: Piece[];
  becameKing?: boolean;
  timestamp?: number;
}

/**
 * One hop of a capture, with any further hops hanging off `continuations`.
 *
 * A node is not a move: `position` is where this single jump lands, and
 * `capturedPieces` is what this jump alone takes. Use `enumerateMoves` or
 * `resolveCapturePath` in rules.ts to get a whole turn — treating a node as a
 * move is what caused both the AI and the board to lose pieces mid-chain.
 */
export interface PossibleMove {
  position: Position;
  isCapture: boolean;
  capturedPieces: Piece[];
  continuations?: PossibleMove[];
}

// ============================================
// GAME STATE
// ============================================

export interface GameState {
  board: Board;
  currentPlayer: PlayerColor;
  selectedPiece: Piece | null;
  /** Squares the selected piece may move to, capture landings included. */
  validMoves: Position[];
  /** Capture trees for the selected piece, when captures are available. */
  possibleCaptures: PossibleMove[];
  moveHistory: Move[];
  /** Pieces each side has captured. */
  score: {
    red: number;
    black: number;
  };
  gameStatus: GameStatus;
  gameMode: GameMode;
  winner?: PlayerColor;
  /** When the current turn began, used to charge the clock. */
  turnStartTime?: number;
  /** Seconds remaining per player. Fractional: sub-second turns must still cost. */
  playerTimers?: {
    red: number;
    black: number;
  };
  mustCapture: boolean;
}
