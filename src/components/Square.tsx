import { Piece as GamePiece, Position } from '../types';
import Piece from './Piece';
import { BoardTheme, PieceStyle, getSquareColor } from '../utils/visualThemes';
import { squareName, isPlayableSquare } from '../utils/rules';

interface SquareProps {
  position: Position;
  piece: GamePiece | null;
  isLight: boolean;
  isValidMove: boolean;
  isSelected: boolean;
  onSquareClick: (position: Position) => void;
  onPieceClick: (piece: GamePiece) => void;
  isShaking: boolean;
  hasCapture: boolean;
  boardTheme: BoardTheme;
  pieceStyle: PieceStyle;
  animationsEnabled: boolean;
  showMoveHints: boolean;
  /** True when the board's keyboard cursor is on this square. */
  isCursor: boolean;
  onFocusCell: (position: Position) => void;
  registerCell: (row: number, col: number, el: HTMLDivElement | null) => void;
}

/** What a screen reader announces for this square. */
function describe(
  position: Position,
  piece: GamePiece | null,
  isValidMove: boolean,
  isSelected: boolean,
  hasCapture: boolean
): string {
  const name = squareName(position.row, position.col);

  if (!isPlayableSquare(position.row, position.col)) {
    return `${name}, unplayable square`;
  }

  const parts = [name];
  if (piece) {
    parts.push(`${piece.color} ${piece.type === 'king' ? 'king' : 'piece'}`);
    if (isSelected) parts.push('selected');
    // A capture is signalled visually by a glow around the piece, which said
    // nothing to anyone not looking at it. It matters more than decoration:
    // captures are mandatory, so these are the only pieces that can be played.
    if (hasCapture) parts.push('capture available');
  } else {
    parts.push('empty');
  }
  if (isValidMove) parts.push('available move');

  return parts.join(', ');
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
  isCursor,
  onFocusCell,
  registerCell,
}: SquareProps) => {
  // Use theme-based colors
  const bgColor = getSquareColor(boardTheme, isLight);
  const hoverEffect = isValidMove ? 'hover:brightness-110 cursor-pointer' : piece ? 'cursor-pointer' : '';

  // This square owns the click for the whole cell. Piece deliberately has no
  // handler of its own — when it did, every click fired twice.
  const activate = () => {
    if (piece) {
      onPieceClick(piece);
    } else if (isValidMove) {
      onSquareClick(position);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Arrow keys are handled by the board, which owns the cursor.
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate();
    }
  };

  const playable = isPlayableSquare(position.row, position.col);

  return (
    <div
      ref={el => registerCell(position.row, position.col, el)}
      role="gridcell"
      aria-label={describe(position, piece, isValidMove, isSelected, hasCapture)}
      aria-selected={isSelected}
      // Roving tabindex: only the cursor square is reachable with Tab, so the
      // board is one stop rather than 64.
      tabIndex={isCursor ? 0 : -1}
      onFocus={() => onFocusCell(position)}
      onKeyDown={handleKeyDown}
      style={{ backgroundColor: bgColor }}
      className={`${hoverEffect} relative transition-all duration-200
        focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-sky-400
        ${isCursor ? 'ring-2 ring-inset ring-sky-400/70' : ''}`}
      onClick={activate}
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
        {isValidMove && !piece && showMoveHints && playable && (
          <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-green-500/40 border-2 border-green-400/60 animate-pulse shadow-lg" />
        )}
      </div>
    </div>
  );
};

export default Square;
