import { useState, useEffect } from 'react';
import Header from './components/Header';
import MainMenu from './components/MainMenu';
import Game from './components/Game';
import GameModeSelection from './components/GameModeSelection';
import HowToPlay from './components/HowToPlay';
import Settings from './components/Settings';
import { ToastProvider } from './components/ToastNotification';
import { GameMode } from './types';
import { hasGameInProgress, getSavedGameMode, clearGameState } from './utils/gamePersistence';

type AppScreen = 'menu' | 'mode-selection' | 'game' | 'settings' | 'how-to-play';

function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('menu');
  const [selectedMode, setSelectedMode] = useState<GameMode>('pvp');
  const [hasGameInProgressState, setHasGameInProgressState] = useState(false);

  // Check if there's a saved game on mount
  useEffect(() => {
    checkForSavedGame();
  }, []);

  // Check localStorage for saved game
  function checkForSavedGame() {
    try {
      const hasGame = hasGameInProgress();
      setHasGameInProgressState(hasGame);
    } catch (error) {
      console.error('Failed to check for saved game:', error);
      setHasGameInProgressState(false);
    }
  }

  // Update hasGameInProgress when returning to menu
  const handleBackToMenu = () => {
    setCurrentScreen('menu');
    // Always check for saved game when returning to menu
    checkForSavedGame();
  };

  // Handle back to menu after quitting (don't check for saved games)
  const handleBackToMenuAfterQuit = () => {
    setCurrentScreen('menu');
    // Don't check for saved games since we just cleared them
  };

  const handleNewGame = () => {
    setCurrentScreen('mode-selection');
    setHasGameInProgressState(false);
  };

  const handleResumeGame = () => {
    try {
      const savedMode = getSavedGameMode();
      if (savedMode && hasGameInProgress()) {
        setSelectedMode(savedMode as GameMode);
        setCurrentScreen('game');
        return;
      }
    } catch (error) {
      console.error('Failed to resume game:', error);
    }
    // Fallback if resume fails
    setHasGameInProgressState(false);
  };

  const handleModeSelect = (mode: GameMode) => {
    // Clear any existing saved game when starting new game
    try {
      clearGameState();
    } catch (error) {
      console.error('Failed to clear saved game:', error);
    }
    
    setSelectedMode(mode);
    setCurrentScreen('game');
    setHasGameInProgressState(false);
  };

  const handleGameQuit = () => {
    // Immediately update the state to hide resume button
    setHasGameInProgressState(false);
  };

  const handleSettings = () => {
    setCurrentScreen('settings');
  };

  const handleHowToPlay = () => {
    setCurrentScreen('how-to-play');
  };

  return (
    <ToastProvider>
      <div className="font-display bg-background-light dark:bg-background-dark text-white checker-bg min-h-screen flex flex-col">
        <Header onSettingsClick={handleSettings} />

        {/* Main Content */}
        {currentScreen === 'menu' && (
          <MainMenu
            onNewGame={handleNewGame}
            onResumeGame={hasGameInProgressState ? handleResumeGame : undefined}
            onSettings={handleSettings}
            onHowToPlay={handleHowToPlay}
            hasGameInProgress={hasGameInProgressState}
          />
        )}

        {currentScreen === 'mode-selection' && (
          <GameModeSelection
            onSelectMode={handleModeSelect}
            onBack={handleBackToMenu}
          />
        )}

        {currentScreen === 'game' && (
          <Game
            onBackToMenu={handleBackToMenu}
            onBackToMenuAfterQuit={handleBackToMenuAfterQuit}
            onGameQuit={handleGameQuit}
            gameMode={selectedMode}
          />
        )}

        {currentScreen === 'how-to-play' && (
          <HowToPlay onBack={handleBackToMenu} />
        )}

        {currentScreen === 'settings' && (
          <Settings onBack={handleBackToMenu} />
        )}
      </div>
    </ToastProvider>
  );
}

export default App;
