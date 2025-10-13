import { Piece as PieceType, Position } from '../types';
import Square from './Square';

interface BoardProps {
  board: (PieceType | null)[][];
  selectedPiece: PieceType | null;
  validMoves: Position[];
  onSquareClick: (position: Position) => void;
  onPieceClick: (piece: PieceType) => void;
}

const Board = ({ board, selectedPiece, validMoves, onSquareClick, onPieceClick }: BoardProps) => {
  const isValidMove = (row: number, col: number): boolean => {
    return validMoves.some(move => move.row === row && move.col === col);
  };

  const isSelected = (piece: PieceType | null): boolean => {
    return piece !== null && selectedPiece !== null && piece.id === selectedPiece.id;
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-gray-800 dark:bg-gray-900 p-4 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.25)]">
        <div className="aspect-square w-full grid grid-cols-8 grid-rows-8 gap-0 rounded-lg overflow-hidden border-4 border-gray-700 dark:border-gray-800">
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

