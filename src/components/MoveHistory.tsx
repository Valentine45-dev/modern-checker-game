import { Swords, Crown } from 'lucide-react';
import { Move } from '../types';

interface MoveHistoryProps {
  moves: Move[];
  maxDisplay?: number;
}

const MoveHistory = ({ moves, maxDisplay = 5 }: MoveHistoryProps) => {
  const recentMoves = moves.slice(-maxDisplay).reverse();

  const formatPosition = (row: number, col: number): string => {
    const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    return `${cols[col]}${8 - row}`;
  };

  return (
    <div className="bg-background-light/80 dark:bg-background-dark/90 backdrop-blur-sm p-4 rounded-xl border border-primary/20">
      <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-3">Move History</h3>
      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
        {recentMoves.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No moves yet</p>
        ) : (
          recentMoves.map((move, index) => (
            <div 
              key={moves.length - index - 1}
              className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 bg-primary/5 dark:bg-primary/10 p-2.5 rounded-lg hover:bg-primary/10 dark:hover:bg-primary/15 transition-colors"
            >
              <span className="font-bold text-gray-900 dark:text-white">#{moves.length - index}:</span>{' '}
              <span className="font-mono">{formatPosition(move.from.row, move.from.col)} → {formatPosition(move.to.row, move.to.col)}</span>
              {move.capturedPieces && move.capturedPieces.length > 0 && (
                <Swords className="inline-block w-3.5 h-3.5 ml-1 text-red-500 align-text-bottom" aria-label="capture" />
              )}
              {move.becameKing && (
                <Crown className="inline-block w-3.5 h-3.5 ml-1 text-yellow-400 align-text-bottom" aria-label="promoted to king" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MoveHistory;

