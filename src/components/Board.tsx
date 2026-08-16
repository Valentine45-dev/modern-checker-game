import { Piece as PieceType, Position } from '../types';
import Square from './Square';
import { getGameSettings } from '../utils/gameSettings';
import { getBoardTheme, getPieceStyle, getBoardFrameClasses, getBoardGridClasses } from '../utils/visualThemes';

interface BoardProps {
  board: (PieceType | null)[][];
  selectedPiece: PieceType | null;
  validMoves: Position[];
  onSquareClick: (position: Position) => void;
  onPieceClick: (piece: PieceType) => void;
  shakingPieceId: string | null;
  piecesWithCaptures: Set<string>;
}

const Board = ({ board, selectedPiece, validMoves, onSquareClick, onPieceClick, shakingPieceId, piecesWithCaptures }: BoardProps) => {
  // Read once for the whole board. Square and Piece used to call this
  // themselves, which meant a synchronous localStorage read and JSON.parse per
  // square and per piece — 64+ of them on every repaint.
  const gameSettings = getGameSettings();
  const boardTheme = getBoardTheme(gameSettings);
  const pieceStyle = getPieceStyle(gameSettings);

  const isValidMove = (row: number, col: number): boolean => {
    return validMoves.some(move => move.row === row && move.col === col);
  };

  const isSelected = (piece: PieceType | null): boolean => {
    return piece !== null && selectedPiece !== null && piece.id === selectedPiece.id;
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className={getBoardFrameClasses(boardTheme)}>
        <div className={getBoardGridClasses(boardTheme)}>
          {board.map((row, rowIndex) =>
            row.map((piece, colIndex) => {
              const isLight = (rowIndex + colIndex) % 2 === 0;
              return (
                <Square
                  key={`${rowIndex}-${colIndex}`}
                  position={{ row: rowIndex, col: colIndex }}
                  piece={piece}
                  isLight={isLight}
                  isValidMove={isValidMove(rowIndex, colIndex)}
                  isSelected={isSelected(piece)}
                  onSquareClick={onSquareClick}
                  onPieceClick={onPieceClick}
                  isShaking={piece !== null && piece.id === shakingPieceId}
                  hasCapture={piece !== null && piecesWithCaptures.has(piece.id)}
                  boardTheme={boardTheme}
                  pieceStyle={pieceStyle}
                  animationsEnabled={gameSettings.animationsEnabled}
                  showMoveHints={gameSettings.showMoveHints}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Board;
