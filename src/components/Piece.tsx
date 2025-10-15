import { Piece as PieceType } from '../types';
import { getGameSettings } from '../utils/gameSettings';
import { getPieceStyle, getPieceClasses, getKingIconClasses } from '../utils/visualThemes';

interface PieceProps {
  piece: PieceType;
  isSelected: boolean;
  isShaking: boolean;
  hasCapture: boolean;
  onClick: () => void;
}

const Piece = ({ piece, isSelected, isShaking, hasCapture, onClick }: PieceProps) => {
  const gameSettings = getGameSettings();
  const pieceStyle = getPieceStyle(gameSettings);
  
  const className = getPieceClasses(
    pieceStyle,
    piece,
    isSelected,
    isShaking,
    hasCapture,
    gameSettings.animationsEnabled
  );
  
  return (
    <div 
      onClick={onClick}
      className={className}
    >
      {piece.type === 'king' && (
        <svg 
          className={getKingIconClasses(pieceStyle)}
          fill="currentColor" 
          viewBox="0 0 24 24"
        >
          <path d="M12 2L15 9L22 9L17 14L19 21L12 17L5 21L7 14L2 9L9 9L12 2Z" />
        </svg>
      )}
    </div>
  );
};

export default Piece;

