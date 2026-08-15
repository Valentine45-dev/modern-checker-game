import { Users, Bot, Brain, Flame, ArrowLeft } from 'lucide-react';
import { GameMode } from '../types';

interface GameModeSelectionProps {
  onSelectMode: (mode: GameMode) => void;
  onBack: () => void;
}

const GameModeSelection = ({ onSelectMode, onBack }: GameModeSelectionProps) => {
  const gameModes = [
    {
      id: 'pvp' as GameMode,
      title: 'Player vs Player',
      description: 'Play against a friend locally',
      Icon: Users,
      gradient: 'from-blue-500 to-purple-600'
    },
    {
      id: 'ai-easy' as GameMode,
      title: 'vs AI - Easy',
      description: 'Perfect for beginners',
      Icon: Bot,
      gradient: 'from-green-500 to-emerald-600'
    },
    {
      id: 'ai-medium' as GameMode,
      title: 'vs AI - Medium',
      description: 'Balanced challenge',
      Icon: Brain,
      gradient: 'from-yellow-500 to-orange-600'
    },
    {
      id: 'ai-hard' as GameMode,
      title: 'vs AI - Hard',
      description: 'For experienced players',
      Icon: Flame,
      gradient: 'from-red-500 to-pink-600'
    }
  ];

  return (
    <main className="flex-grow flex items-center justify-center py-8 px-4">
      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Choose Game Mode
          </h1>
          <p className="text-lg text-gray-300">
            Select how you want to play
          </p>
        </div>

        {/* Game Mode Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {gameModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => onSelectMode(mode.id)}
              className={`group relative overflow-hidden rounded-2xl p-8 bg-gradient-to-br ${mode.gradient} 
                         hover:scale-105 transition-all duration-300 transform hover:shadow-2xl
                         focus:outline-none focus:ring-4 focus:ring-white/30`}
            >
              {/* Background Pattern */}
              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/5 transition-colors duration-300" />
              
              {/* Content */}
              <div className="relative z-10 text-center">
                <div className="mb-4 flex justify-center group-hover:scale-110 transition-transform duration-300">
                  <mode.Icon className="w-14 h-14 text-white" strokeWidth={1.5} aria-hidden="true" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-yellow-200 transition-colors duration-300">
                  {mode.title}
                </h3>
                <p className="text-white/90 group-hover:text-white transition-colors duration-300">
                  {mode.description}
                </p>
              </div>

              {/* Hover Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent 
                             transform -skew-x-12 -translate-x-full group-hover:translate-x-full 
                             transition-transform duration-700" />
            </button>
          ))}
        </div>

        {/* Back Button */}
        <div className="text-center">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg
                       transition-all duration-300 backdrop-blur-sm border border-white/20
                       hover:border-white/30 focus:outline-none focus:ring-4 focus:ring-white/30"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back to Menu
          </button>
        </div>
      </div>
    </main>
  );
};

export default GameModeSelection;
