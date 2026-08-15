import { Crown } from 'lucide-react';
import { Piece as PieceType } from '../types';
import { getGameSettings } from '../utils/gameSettings';
import { getPieceStyle, getPieceClasses, getKingIconClasses } from '../utils/visualThemes';

interface PieceProps {
  piece: PieceType;
  isSelected: boolean;
  isShaking: boolean;
  hasCapture: boolean;
}

// Note: this component deliberately has no onClick. The parent Square owns the
// click for the whole cell — giving the piece its own handler made every click
// fire twice (once here, once again as the event bubbled up to Square).
const Piece = ({ piece, isSelected, isShaking, hasCapture }: PieceProps) => {
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

  const label = `${piece.color} ${piece.type === 'king' ? 'king' : 'piece'}`;

  return (
    <div className={className} role="img" aria-label={label}>
      {piece.type === 'king' && (
        // Was a 5-pointed star path, despite everything in the UI calling it a
        // crown. Now actually a crown.
        <Crown className={getKingIconClasses(pieceStyle)} aria-hidden="true" />
      )}
    </div>
  );
};

export default Piece;
