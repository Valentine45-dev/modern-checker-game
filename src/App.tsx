import { useState } from 'react';
import Header from './components/Header';
import MainMenu from './components/MainMenu';
import Game from './components/Game';
import GameModeModal from './components/GameModeModal';
import { ToastProvider } from './components/ToastNotification';
import { GameMode } from './types';

type Screen = 'menu' | 'game' | 'settings';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('menu');
  const [hasGameInProgress] = useState(false);
  const [showModeModal, setShowModeModal] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode>('pvp');

  const handleNewGame = () => {
    setShowModeModal(true);
  };

  const handleSelectMode = (mode: GameMode) => {
    setSelectedMode(mode);
    setShowModeModal(false);
    setCurrentScreen('game');
  };

  const handleResumeGame = () => {
    setCurrentScreen('game');
  };

  const handleSettings = () => {
    setCurrentScreen('settings');
  };

  const handleBackToMenu = () => {
    setCurrentScreen('menu');
  };

  return (
    <ToastProvider position="top-right">
      <div className="font-display bg-background-light dark:bg-background-dark text-white checker-bg min-h-screen flex flex-col">
        <Header onSettingsClick={handleSettings} />
      
      {currentScreen === 'menu' && (
        <MainMenu 
          onNewGame={handleNewGame}
          onResumeGame={handleResumeGame}
          onSettings={handleSettings}
          hasGameInProgress={hasGameInProgress}
        />
      )}
      
      {currentScreen === 'game' && (
        <Game 
          onBackToMenu={handleBackToMenu}
          gameMode={selectedMode}
        />
      )}
      
      {currentScreen === 'settings' && (
        <main className="flex-grow flex items-center justify-center p-4">
          <div className="text-center">
            <h2 className="text-2xl text-white mb-4">Settings Coming Soon!</h2>
            <button 
              onClick={handleBackToMenu}
              className="px-6 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg"
            >
              Back to Menu
            </button>
          </div>
        </main>
      )}

      {/* Game Mode Selection Modal */}
      <GameModeModal
        isOpen={showModeModal}
        onClose={() => setShowModeModal(false)}
        onSelectMode={handleSelectMode}
      />
      </div>
    </ToastProvider>
  );
}

export default App;
