import { Users, Bot, Target, Flame } from 'lucide-react';
import { PlayerColor, GameMode } from '../types';

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
}

const GameInfo = ({ currentPlayer, turnNumber, capturedPieces, timer, gameMode = 'pvp' }: GameInfoProps) => {
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

      {/* Captured Pieces Card */}
      <div className="bg-background-light/80 dark:bg-background-dark/90 backdrop-blur-sm p-4 rounded-xl border border-primary/20">
        <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-3">Captured Pieces</h3>
        <div className="flex items-center justify-around gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-red-600 border-2 border-red-800 shadow-md" />
            <span className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">x </span>{capturedPieces.red}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-gray-500 dark:border-gray-700 shadow-md" />
            <span className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">x </span>{capturedPieces.black}
            </span>
          </div>
        </div>
      </div>

      {/* Timer Card */}
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
    </div>
  );
};

export default GameInfo;

