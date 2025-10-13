interface MainMenuProps {
  onNewGame: () => void;
  onResumeGame?: () => void;
  onSettings: () => void;
  hasGameInProgress?: boolean;
}

const MainMenu = ({ 
  onNewGame, 
  onResumeGame, 
  onSettings, 
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
              fill="none" 
              viewBox="0 0 48 48" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M6 6H42L36 24L42 42H6L12 24L6 6Z" fill="currentColor" />
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
            onClick={() => alert('Rules coming soon!')}
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

