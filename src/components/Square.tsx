
import { Piece as PieceType, Position } from '../types';
import Piece from './Piece';
import { getGameSettings } from '../utils/gameSettings';

interface SquareProps {
  position: Position;
  piece: PieceType | null;
  isLight: boolean;
  isValidMove: boolean;
  isSelected: boolean;
  onSquareClick: (position: Position) => void;
  onPieceClick: (piece: PieceType) => void;
  isShaking: boolean;
  hasCapture: boolean;
}

const Square = ({ 
  position, 
  piece, 
  isLight, 
  isValidMove, 
  isSelected,
  onSquareClick,
  onPieceClick,
  isShaking,
  hasCapture
}: SquareProps) => {
  const gameSettings = getGameSettings();
  
  // Use inline styles to ensure colors show properly
  const bgColor = isLight ? '#EADCCF' : '#A98467';
  const hoverEffect = isValidMove ? 'hover:brightness-110 cursor-pointer' : piece ? 'cursor-pointer' : '';
  
  const handleClick = () => {
    if (piece) {
      onPieceClick(piece);
    } else if (isValidMove) {
      onSquareClick(position);
    }
  };

  return (
    <div 
      style={{ backgroundColor: bgColor }}
      className={`${hoverEffect} relative transition-all duration-200`}
      onClick={handleClick}
    >
      <div className="absolute inset-0 flex items-center justify-center p-1">
        {piece && (
          <Piece 
            piece={piece} 
            isSelected={isSelected}
            isShaking={isShaking}
            hasCapture={hasCapture}
            onClick={() => onPieceClick(piece)}
          />
        )}
        {isValidMove && !piece && gameSettings.showMoveHints && (
          <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-green-500/40 border-2 border-green-400/60 animate-pulse shadow-lg" />
        )}
      </div>
    </div>
  );
};

export default Square;

