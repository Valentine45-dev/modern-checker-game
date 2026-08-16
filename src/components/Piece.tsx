import { Crown } from 'lucide-react';
import { Piece as GamePiece } from '../types';
import { PieceStyle, getPieceClasses, getKingIconClasses } from '../utils/visualThemes';

interface PieceProps {
  piece: GamePiece;
  isSelected: boolean;
  isShaking: boolean;
  hasCapture: boolean;
  pieceStyle: PieceStyle;
  animationsEnabled: boolean;
}

// Note: this component deliberately has no onClick. The parent Square owns the
// click for the whole cell — giving the piece its own handler made every click
// fire twice (once here, once again as the event bubbled up to Square).
//
// Style and animation flags are passed in rather than read here, so the board
// reads settings once instead of once per piece.
const Piece = ({ piece, isSelected, isShaking, hasCapture, pieceStyle, animationsEnabled }: PieceProps) => {
  const className = getPieceClasses(
    pieceStyle,
    piece,
    isSelected,
    isShaking,
    hasCapture,
    animationsEnabled
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
