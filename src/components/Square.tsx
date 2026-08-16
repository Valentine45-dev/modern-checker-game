import { Piece as PieceType, Position } from '../types';
import Piece from './Piece';
import { BoardTheme, PieceStyle, getSquareColor } from '../utils/visualThemes';

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
  boardTheme: BoardTheme;
  pieceStyle: PieceStyle;
  animationsEnabled: boolean;
  showMoveHints: boolean;
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
  hasCapture,
  boardTheme,
  pieceStyle,
  animationsEnabled,
  showMoveHints,
}: SquareProps) => {
  // Use theme-based colors
  const bgColor = getSquareColor(boardTheme, isLight);
  const hoverEffect = isValidMove ? 'hover:brightness-110 cursor-pointer' : piece ? 'cursor-pointer' : '';

  // This square owns the click for the whole cell. Piece deliberately has no
  // handler of its own — when it did, every click fired twice.
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
            pieceStyle={pieceStyle}
            animationsEnabled={animationsEnabled}
          />
        )}
        {isValidMove && !piece && showMoveHints && (
          <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-green-500/40 border-2 border-green-400/60 animate-pulse shadow-lg" />
        )}
      </div>
    </div>
  );
};

export default Square;
