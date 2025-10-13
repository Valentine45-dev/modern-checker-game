import { Piece as PieceType } from '../types';

interface PieceProps {
  piece: PieceType;
  isSelected: boolean;
  onClick: () => void;
}

const Piece = ({ piece, isSelected, onClick }: PieceProps) => {
  const baseClasses = "w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full shadow-lg cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95";
  
  const colorClasses = piece.color === 'red' 
    ? "bg-red-600 border-2 sm:border-3 border-red-800 shadow-red-900/50" 
    : "bg-gray-300 dark:bg-gray-600 border-2 sm:border-3 border-gray-500 dark:border-gray-700 shadow-gray-900/50";
  
  const selectedClasses = isSelected ? "ring-2 sm:ring-4 ring-blue-500 ring-offset-2 ring-offset-transparent scale-110" : "";
  
  return (
    <div 
      onClick={onClick}
      className={`${baseClasses} ${colorClasses} ${selectedClasses} flex items-center justify-center relative`}
    >
      {piece.type === 'king' && (
        <svg 
          className="w-4 h-4 sm:w-6 sm:h-6 text-yellow-400 drop-shadow-lg" 
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

