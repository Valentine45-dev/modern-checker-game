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

// Helper type for board coordinates (optional but useful)
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

export interface Move {
  from: Position;
  to: Position;
  capturedPieces?: Piece[]; // 🔥 Changed to array for multi-captures
  becameKing?: boolean;
  timestamp?: number; // For move history timing
  isForced?: boolean; // To mark mandatory captures
}

// For calculating possible moves
export interface PossibleMove {
  position: Position;
  isCapture: boolean;
  capturedPieces: Piece[];
  continuations?: PossibleMove[]; // For multi-jump sequences
}

// ============================================
// GAME STATE
// ============================================

export interface GameState {
  board: Board;
  currentPlayer: PlayerColor;
  selectedPiece: Piece | null;
  validMoves: Position[]; // 🤔 Consider changing to PossibleMove[]
  possibleCaptures: PossibleMove[]; // 🔥 NEW: Track mandatory captures
  moveHistory: Move[];
  score: {
    red: number;
    black: number;
  };
  capturedPieces: {
    red: Piece[];
    black: Piece[];
  }; // 🔥 NEW: Store actual captured pieces
  gameStatus: GameStatus;
  gameMode: GameMode; // 🔥 NEW: Track game mode
  winner?: PlayerColor;
  turnStartTime?: number; // 🔥 NEW: For timer
  playerTimers?: {
    red: number;
    black: number;
  }; // 🔥 NEW: Track elapsed time per player
  mustCapture: boolean; // 🔥 NEW: Flag for mandatory capture rule
}

// ============================================
// GAME SETTINGS
// ============================================

export interface GameSettings {
  mode: GameMode;
  timerEnabled: boolean;
  timePerPlayer: number; // in seconds
  soundEnabled: boolean;
  showValidMoves: boolean;
  showMoveHistory: boolean;
  allowUndo: boolean;
  flyingKings: boolean; // 🔥 International checkers rule
}

// ============================================
// UI STATE (Optional - separate from game logic)
// ============================================

export interface UIState {
  highlightedSquares: Position[];
  animatingPiece?: {
    piece: Piece;
    from: Position;
    to: Position;
  };
  showingModal?: 'settings' | 'rules' | 'gameOver' | 'pause';
  notification?: {
    message: string;
    type: 'info' | 'warning' | 'success' | 'error';
  };
}

// ============================================
// GAME RESULT
// ============================================

export interface GameResult {
  winner: PlayerColor;
  reason: 'no-pieces' | 'no-moves' | 'resignation' | 'timeout';
  finalScore: {
    red: number;
    black: number;
  };
  totalMoves: number;
  duration: number; // in seconds
  capturedPieces: {
    red: number;
    black: number;
  };
  kingsPromoted: {
    red: number;
    black: number;
  };
}

// ============================================
// HELPER TYPES & UTILITIES
// ============================================

// For move validation
export interface MoveValidation {
  isValid: boolean;
  reason?: string;
  requiredCaptures?: PossibleMove[];
}

// For AI
export interface AIMove {
  move: Move;
  score: number;
  depth: number;
}

// For game statistics
export interface GameStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  averageMovesPerGame: number;
  longestGame: number;
  shortestGame: number;
}