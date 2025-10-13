import { useState } from 'react';
import Header from './components/Header';
import MainMenu from './components/MainMenu';
import Game from './components/Game';

type Screen = 'menu' | 'game' | 'settings';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('menu');
  const [hasGameInProgress] = useState(false);

  const handleNewGame = () => {
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
        <Game onBackToMenu={handleBackToMenu} />
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
    </div>
  );
}

export default App;
