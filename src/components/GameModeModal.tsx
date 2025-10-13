import { GameMode } from '../types';

interface GameModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMode: (mode: GameMode) => void;
}

const GameModeModal = ({ isOpen, onClose, onSelectMode }: GameModeModalProps) => {
  if (!isOpen) return null;

  const modes = [
    {
      mode: 'pvp' as GameMode,
      title: 'Player vs Player',
      description: 'Play against a friend on the same device',
      icon: '👥',
      color: 'from-blue-500 to-blue-600'
    },
    {
      mode: 'ai-easy' as GameMode,
      title: 'vs AI - Easy',
      description: 'Perfect for beginners learning the game',
      icon: '🤖',
      color: 'from-green-500 to-green-600'
    },
    {
      mode: 'ai-medium' as GameMode,
      title: 'vs AI - Medium',
      description: 'A balanced challenge for most players',
      icon: '🎯',
      color: 'from-yellow-500 to-yellow-600'
    },
    {
      mode: 'ai-hard' as GameMode,
      title: 'vs AI - Hard',
      description: 'Test your skills against a tough opponent',
      icon: '🔥',
      color: 'from-red-500 to-red-600'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background-light dark:bg-background-dark rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-primary/20">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Select Game Mode
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-primary/10 transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Choose how you want to play
          </p>
        </div>

        {/* Mode Options */}
        <div className="p-6 grid gap-4">
          {modes.map((option) => (
            <button
              key={option.mode}
              onClick={() => onSelectMode(option.mode)}
              className="group relative overflow-hidden bg-gradient-to-br from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/20 border border-primary/20 hover:border-primary/40 rounded-xl p-5 text-left transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg"
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br ${option.color} flex items-center justify-center text-2xl sm:text-3xl shadow-lg`}>
                  {option.icon}
                </div>
                
                {/* Content */}
                <div className="flex-grow">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-1">
                    {option.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {option.description}
                  </p>
                </div>

                {/* Arrow */}
                <div className="flex-shrink-0 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200 transition-colors">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-primary/20 bg-primary/5">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>AI modes coming soon! For now, enjoy Player vs Player mode.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameModeModal;

