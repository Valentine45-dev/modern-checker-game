export type PieceType = 'normal' | 'king';
export type PlayerColor = 'red' | 'black';

export interface Position {
  row: number;
  col: number;
}

export interface Piece {
  id: string;
  color: PlayerColor;
  type: PieceType;
  position: Position;
}

export interface Move {
  from: Position;
  to: Position;
  capturedPiece?: Piece;
  becameKing?: boolean;
}

export interface GameState {
  board: (Piece | null)[][];
  currentPlayer: PlayerColor;
  selectedPiece: Piece | null;
  validMoves: Position[];
  moveHistory: Move[];
  score: {
    red: number;
    black: number;
  };
  gameStatus: 'menu' | 'playing' | 'paused' | 'finished';
  winner?: PlayerColor;
}

