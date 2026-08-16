import { Users, Bot, Target, Flame } from 'lucide-react';
import { PlayerColor, GameMode } from '../types';
import { capturedLabel } from '../utils/labels';

interface GameInfoProps {
  currentPlayer: PlayerColor;
  turnNumber: number;
  capturedPieces: {
    red: number;
    black: number;
  };
  timer: {
    red: number;
    black: number;
  };
  gameMode?: GameMode;
  /** The clock is opt-in; hide the card entirely when it is off. */
  showTimer?: boolean;
}

const GameInfo = ({ currentPlayer, turnNumber, capturedPieces, timer, gameMode = 'pvp', showTimer = true }: GameInfoProps) => {
  const isAIGame = gameMode !== 'pvp';
  
  const MODE_LABELS: Record<GameMode, { Icon: typeof Users; label: string }> = {
    'pvp': { Icon: Users, label: 'PvP' },
    'ai-easy': { Icon: Bot, label: 'vs AI (Easy)' },
    'ai-medium': { Icon: Target, label: 'vs AI (Medium)' },
    'ai-hard': { Icon: Flame, label: 'vs AI (Hard)' },
  };

  const mode = MODE_LABELS[gameMode] ?? MODE_LABELS.pvp;
  const ModeIcon = mode.Icon;

  // The red side is the AI in every AI mode, so label it accordingly
  const RedLabel = () =>
    isAIGame ? (
      <span className="inline-flex items-center gap-1.5">
        <Bot className="w-4 h-4" aria-hidden="true" />
        AI
      </span>
    ) : (
      <>Red Player</>
    );


  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="bg-background-light/80 dark:bg-background-dark/90 backdrop-blur-sm p-4 rounded-xl border border-primary/20">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Game Details</h2>
          <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Turn: {turnNumber}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          <span>Mode:</span>
          <ModeIcon className="w-4 h-4" aria-hidden="true" />
          <span>{mode.label}</span>
        </div>
      </div>

      {/* Red Player Card - Always on top */}
      <div className={`bg-background-light/80 dark:bg-background-dark/90 backdrop-blur-sm p-4 rounded-xl transition-all duration-300 ${
        currentPlayer === 'red' 
          ? 'border-2 border-blue-500 shadow-lg shadow-blue-500/20' 
          : 'border border-primary/20'
      }`}>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {currentPlayer === 'red' ? 'Current Player' : 'Waiting...'}
        </p>
        <div className="flex items-center justify-between">
          <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
            <RedLabel />
          </p>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 shadow-lg bg-red-600 border-red-800" />
        </div>
      </div>

      {/* Black Player Card - Always on bottom */}
      <div className={`bg-background-light/80 dark:bg-background-dark/90 backdrop-blur-sm p-4 rounded-xl transition-all duration-300 ${
        currentPlayer === 'black' 
          ? 'border-2 border-blue-500 shadow-lg shadow-blue-500/20' 
          : 'border border-primary/20'
      }`}>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {currentPlayer === 'black' ? 'Current Player' : 'Waiting...'}
        </p>
        <div className="flex items-center justify-between">
          <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
            Black Player
          </p>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 shadow-lg bg-gray-300 dark:bg-gray-600 border-gray-500 dark:border-gray-700" />
        </div>
      </div>

      {/* Captured Pieces Card
          Headed "captured by" on purpose. The count next to the red disc is how
          many pieces red has TAKEN, but a red disc beside a number reads as red
          pieces LOST — the opposite. Naming the owner of the tally fixes it
          without changing which colour identifies which player. */}
      <div className="bg-background-light/80 dark:bg-background-dark/90 backdrop-blur-sm p-4 rounded-xl border border-primary/20">
        <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-3">Pieces captured by</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-1">
            {/* The visual row is split across three elements, so it is hidden from
                assistive tech and replaced by one sentence that survives being
                read out of order. */}
            <span className="sr-only">{capturedLabel(isAIGame ? 'AI' : 'Red player', capturedPieces.red)}</span>
            <div className="flex items-center gap-2" aria-hidden="true">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-red-600 border-2 border-red-800 shadow-md" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                <RedLabel />
              </span>
            </div>
            <span className="text-base sm:text-lg font-bold text-gray-900 dark:text-white" aria-hidden="true">
              {capturedPieces.red}
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="sr-only">{capturedLabel('Black player', capturedPieces.black)}</span>
            <div className="flex items-center gap-2" aria-hidden="true">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-gray-500 dark:border-gray-700 shadow-md" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Black Player</span>
            </div>
            <span className="text-base sm:text-lg font-bold text-gray-900 dark:text-white" aria-hidden="true">
              {capturedPieces.black}
            </span>
          </div>
        </div>
      </div>

      {/* Timer Card */}
      {showTimer && (
      <div className="bg-background-light/80 dark:bg-background-dark/90 backdrop-blur-sm p-4 rounded-xl border border-primary/20">
        <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-3">Timer</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                <RedLabel />
              </span>
            </div>
            <span className="font-mono text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              {formatTime(timer.red)}
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Black Player</span>
            </div>
            <span className="font-mono text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              {formatTime(timer.black)}
            </span>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default GameInfo;

