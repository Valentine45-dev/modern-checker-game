import React from 'react';
import {
  Target, Gamepad2, Users, Bot, ClipboardList, Zap, Repeat, Crown,
  SlidersHorizontal, MousePointerClick, Sparkles, Lightbulb, CheckCircle2,
  Circle, XCircle, Trophy, Swords, ArrowLeft,
} from 'lucide-react';

interface HowToPlayProps {
  onBack: () => void;
}

const HowToPlay: React.FC<HowToPlayProps> = ({ onBack }) => {
  return (
    <main className="flex-grow flex items-center justify-center py-8 px-4">
      <div className="w-full max-w-4xl mx-auto">
        {/* Back button at the top — same reasoning as Settings, this page is a
            long scroll and the only exit used to be at the very bottom. */}
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 mb-6 px-4 py-2 text-gray-300 hover:text-white bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary/40 rounded-lg transition-all duration-200"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to Menu
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">How to Play Checkers</h1>
          <p className="text-lg text-gray-300">Master the classic game of strategy and tactics</p>
        </div>

        {/* Content */}
        <div className="bg-background-light/80 dark:bg-background-dark/90 backdrop-blur-sm rounded-2xl border border-primary/20 p-8 space-y-8">
          
          {/* Game Overview */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <Target className="w-7 h-7 text-accent" aria-hidden="true" />
              Game Overview
            </h2>
            <div className="bg-primary/10 rounded-lg p-6 border border-primary/20">
              <p className="text-gray-200 leading-relaxed">
                Checkers is a classic strategy board game played on an 8×8 board. The objective is to capture all of your opponent's pieces or block them so they cannot move. This implementation follows International Checkers rules with advanced features like flying kings and multi-jump captures.
              </p>
            </div>
          </section>

          {/* Game Modes */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <Gamepad2 className="w-7 h-7 text-accent" aria-hidden="true" />
              Game Modes
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-blue-500/10 rounded-lg p-6 border border-blue-500/20">
                <h3 className="text-xl font-semibold text-blue-300 mb-3"><span className="inline-flex items-center gap-2"><Users className="w-5 h-5" aria-hidden="true" />Player vs Player</span></h3>
                <p className="text-gray-200 text-sm leading-relaxed">
                  Play against a friend locally. Red pieces start first. Perfect for face-to-face competition and learning the game together.
                </p>
              </div>
              <div className="bg-purple-500/10 rounded-lg p-6 border border-purple-500/20">
                <h3 className="text-xl font-semibold text-purple-300 mb-3"><span className="inline-flex items-center gap-2"><Bot className="w-5 h-5" aria-hidden="true" />Player vs AI</span></h3>
                <p className="text-gray-200 text-sm leading-relaxed">
                  Challenge our AI opponent with three difficulty levels: Easy, Medium, and Hard. Black pieces (you) start first against the AI.
                </p>
              </div>
            </div>
          </section>

          {/* Basic Rules */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <ClipboardList className="w-7 h-7 text-accent" aria-hidden="true" />
              Basic Rules
            </h2>
            <div className="space-y-4">
              <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/20">
                <h3 className="text-lg font-semibold text-green-300 mb-2">Piece Movement</h3>
                <ul className="text-gray-200 text-sm space-y-1 ml-4">
                  <li>• Normal pieces move diagonally forward one square at a time</li>
                  <li>• Pieces can only move to dark squares</li>
                  <li>• Kings can move diagonally in any direction (forward and backward)</li>
                  <li>• Kings can move multiple squares in one direction (flying kings)</li>
                </ul>
              </div>
              
              <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
                <h3 className="text-lg font-semibold text-red-300 mb-2">Capturing</h3>
                <ul className="text-gray-200 text-sm space-y-1 ml-4">
                  <li>• Capture by jumping over an opponent's piece diagonally</li>
                  <li>• Captured pieces are removed from the board</li>
                  <li>• Multiple captures in sequence are mandatory</li>
                  <li>• Kings can capture multiple pieces in one move</li>
                </ul>
              </div>

              <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/20">
                <h3 className="text-lg font-semibold text-yellow-300 mb-2">King Promotion</h3>
                <ul className="text-gray-200 text-sm space-y-1 ml-4">
                  <li>• Normal pieces become kings when reaching the opposite end</li>
                  <li>• Kings are marked with a crown icon</li>
                  <li>• Kings have enhanced movement and capturing abilities</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Advanced Features */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <Zap className="w-7 h-7 text-accent" aria-hidden="true" />
              Advanced Features
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-orange-500/10 rounded-lg p-6 border border-orange-500/20">
                <h3 className="text-xl font-semibold text-orange-300 mb-3"><span className="inline-flex items-center gap-2"><Repeat className="w-5 h-5" aria-hidden="true" />Multi-Jump Captures</span></h3>
                <p className="text-gray-200 text-sm leading-relaxed">
                  When you capture a piece, you must continue capturing if more captures are available. The game will highlight your piece and show available continuation moves.
                </p>
              </div>
              <div className="bg-cyan-500/10 rounded-lg p-6 border border-cyan-500/20">
                <h3 className="text-xl font-semibold text-cyan-300 mb-3"><span className="inline-flex items-center gap-2"><Crown className="w-5 h-5" aria-hidden="true" />Flying Kings</span></h3>
                <p className="text-gray-200 text-sm leading-relaxed">
                  Kings can move any number of squares diagonally in one direction, making them powerful pieces for both movement and long-distance captures.
                </p>
              </div>
            </div>
          </section>

          {/* Game Controls */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <SlidersHorizontal className="w-7 h-7 text-accent" aria-hidden="true" />
              Game Controls
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-gray-500/10 rounded-lg p-4 border border-gray-500/20 text-center">
                <div className="mb-2 flex justify-center"><MousePointerClick className="w-6 h-6 text-accent" aria-hidden="true" /></div>
                <h3 className="text-lg font-semibold text-gray-300 mb-2">Click to Select</h3>
                <p className="text-gray-200 text-xs">Click on your piece to select it and see available moves</p>
              </div>
              <div className="bg-gray-500/10 rounded-lg p-4 border border-gray-500/20 text-center">
                <div className="mb-2 flex justify-center"><Target className="w-6 h-6 text-accent" aria-hidden="true" /></div>
                <h3 className="text-lg font-semibold text-gray-300 mb-2">Click to Move</h3>
                <p className="text-gray-200 text-xs">Click on a highlighted square to move your piece</p>
              </div>
              <div className="bg-gray-500/10 rounded-lg p-4 border border-gray-500/20 text-center">
                <div className="mb-2 flex justify-center"><Sparkles className="w-6 h-6 text-accent" aria-hidden="true" /></div>
                <h3 className="text-lg font-semibold text-gray-300 mb-2">Auto-Save</h3>
                <p className="text-gray-200 text-xs">Your game is automatically saved after every move</p>
              </div>
            </div>
          </section>

          {/* Visual Indicators */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <Lightbulb className="w-7 h-7 text-accent" aria-hidden="true" />
              Visual Indicators
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/20">
                  <h3 className="text-lg font-semibold text-green-300 mb-2"><span className="inline-flex items-center gap-2"><CheckCircle2 className="w-5 h-5" aria-hidden="true" />Valid Moves</span></h3>
                  <p className="text-gray-200 text-sm">Green dots show where you can move your selected piece</p>
                </div>
                <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
                  <h3 className="text-lg font-semibold text-blue-300 mb-2"><span className="inline-flex items-center gap-2"><Circle className="w-5 h-5" aria-hidden="true" />Selected Piece</span></h3>
                  <p className="text-gray-200 text-sm">Blue ring around your currently selected piece</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/20">
                  <h3 className="text-lg font-semibold text-yellow-300 mb-2"><span className="inline-flex items-center gap-2"><Zap className="w-5 h-5" aria-hidden="true" />Capture Available</span></h3>
                  <p className="text-gray-200 text-sm">Pieces with mandatory captures glow with a pulsing effect</p>
                </div>
                <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
                  <h3 className="text-lg font-semibold text-red-300 mb-2"><span className="inline-flex items-center gap-2"><XCircle className="w-5 h-5" aria-hidden="true" />Invalid Move</span></h3>
                  <p className="text-gray-200 text-sm">Pieces shake when clicked if they have no valid moves</p>
                </div>
              </div>
            </div>
          </section>

          {/* Winning Conditions */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <Trophy className="w-7 h-7 text-accent" aria-hidden="true" />
              Winning the Game
            </h2>
            <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg p-6 border border-yellow-500/20">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-yellow-300 mb-3">Ways to Win:</h3>
                  <ul className="text-gray-200 text-sm space-y-2">
                    <li>• Capture all opponent pieces</li>
                    <li>• Block opponent so they cannot move</li>
                    <li>• Opponent resigns</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-orange-300 mb-3">Game Features:</h3>
                  <ul className="text-gray-200 text-sm space-y-2">
                    <li>• Move history tracking</li>
                    <li>• Game statistics</li>
                    <li>• Resume saved games</li>
                    <li>• Toast notifications</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Tips */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <Lightbulb className="w-7 h-7 text-accent" aria-hidden="true" />
              Pro Tips
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/20">
                <h3 className="text-lg font-semibold text-purple-300 mb-2"><span className="inline-flex items-center gap-2"><Target className="w-5 h-5" aria-hidden="true" />Strategy</span></h3>
                <p className="text-gray-200 text-xs">Control the center of the board and protect your pieces</p>
              </div>
              <div className="bg-pink-500/10 rounded-lg p-4 border border-pink-500/20">
                <h3 className="text-lg font-semibold text-pink-300 mb-2"><span className="inline-flex items-center gap-2"><Swords className="w-5 h-5" aria-hidden="true" />Captures</span></h3>
                <p className="text-gray-200 text-xs">Always look for multi-jump opportunities to maximize captures</p>
              </div>
              <div className="bg-indigo-500/10 rounded-lg p-4 border border-indigo-500/20">
                <h3 className="text-lg font-semibold text-indigo-300 mb-2"><span className="inline-flex items-center gap-2"><Crown className="w-5 h-5" aria-hidden="true" />Kings</span></h3>
                <p className="text-gray-200 text-xs">Get your pieces to the opposite end to promote them to kings</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
};

export default HowToPlay;
