interface MainMenuProps {
  onNewGame: () => void;
  onResumeGame?: () => void;
  onSettings: () => void;
  onHowToPlay: () => void;
  hasGameInProgress?: boolean;
}

const MainMenu = ({ 
  onNewGame, 
  onResumeGame, 
  onSettings, 
  onHowToPlay,
  hasGameInProgress = false 
}: MainMenuProps) => {
  return (
    <main className="flex-grow flex items-center justify-center p-4">
      <div className="w-full max-w-sm mx-auto text-center bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-sm p-8 rounded-xl shadow-2xl border border-primary/20">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-primary/20 dark:bg-primary/30">
            <svg 
              className="w-12 h-12 text-white" 
              fill="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
              <circle cx="9" cy="12" r="1.5" />
              <circle cx="15" cy="12" r="1.5" />
            </svg>
          </div>
        </div>
        
        {/* Title */}
        <h2 className="text-4xl font-bold text-black dark:text-white mb-2">Checkers</h2>
        <p className="text-black/60 dark:text-white/60 mb-8">Select an option to continue</p>
        
        {/* Menu Buttons */}
        <div className="space-y-4">
          <button 
            onClick={onNewGame}
            className="w-full text-white bg-primary hover:bg-primary/90 dark:hover:bg-primary/90 font-bold py-3 px-4 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-background-light dark:focus:ring-offset-background-dark shadow-lg hover:shadow-xl"
          >
            New Game
          </button>
          
          {hasGameInProgress && onResumeGame && (
            <button 
              onClick={onResumeGame}
              className="w-full text-black dark:text-white bg-primary/20 dark:bg-primary/30 hover:bg-primary/30 dark:hover:bg-primary/40 font-bold py-3 px-4 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105"
            >
              Resume Game
            </button>
          )}
          
          <button 
            onClick={onSettings}
            className="w-full text-black dark:text-white bg-primary/20 dark:bg-primary/30 hover:bg-primary/30 dark:hover:bg-primary/40 font-bold py-3 px-4 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105"
          >
            Settings
          </button>
          
          <button 
            onClick={onHowToPlay}
            className="w-full text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white font-medium py-2 px-4 rounded-lg transition-all duration-200"
          >
            How to Play
          </button>
        </div>
        
        {/* Version */}
        <p className="mt-8 text-xs text-black/40 dark:text-white/40">v1.0.0</p>
      </div>
    </main>
  );
};

export default MainMenu;

