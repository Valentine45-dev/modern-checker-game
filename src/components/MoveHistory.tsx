import { Swords, Crown } from 'lucide-react';
import { Move } from '../types';
import { squareName } from '../utils/rules';

interface MoveHistoryProps {
  moves: Move[];
  maxDisplay?: number;
}

const MoveHistory = ({ moves, maxDisplay = 5 }: MoveHistoryProps) => {
  const recentMoves = moves.slice(-maxDisplay).reverse();

  // Shared with the board's screen-reader labels, so a move reads the same way
  // in the history as the square it landed on announces itself.
  const formatPosition = squareName;

  return (
    <div className="bg-background-light/80 dark:bg-background-dark/90 backdrop-blur-sm p-4 rounded-xl border border-primary/20">
      <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-3">Move History</h3>
      {/* Fixed height, not max-height. Growing by one entry per move changed the
          sidebar's height, and because the page is vertically centred every move
          nudged the whole layout — the board appeared to drift up and down as you
          played. A constant height scrolls internally instead. */}
      <div className="space-y-2 h-48 overflow-y-auto custom-scrollbar">
        {recentMoves.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No moves yet</p>
        ) : (
          recentMoves.map((move, index) => (
            <div 
              key={moves.length - index - 1}
              className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 bg-primary/5 dark:bg-primary/10 p-2.5 rounded-lg hover:bg-primary/10 dark:hover:bg-primary/15 transition-colors"
            >
              {/* Who moved. Entries from saves written before `color` existed
                  have none, and simply render without the marker. The disc is
                  decorative; the colour is named for screen readers instead. */}
              {move.color && (
                <>
                  <span className="sr-only">{move.color === 'red' ? 'Red' : 'Black'}: </span>
                  <span
                    className={`inline-block w-2.5 h-2.5 mr-1.5 rounded-full border align-middle ${
                      move.color === 'red'
                        ? 'bg-red-600 border-red-800'
                        : 'bg-gray-300 dark:bg-gray-600 border-gray-500 dark:border-gray-700'
                    }`}
                    aria-hidden="true"
                  />
                </>
              )}
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

