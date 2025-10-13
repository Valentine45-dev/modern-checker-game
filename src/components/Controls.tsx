interface ControlsProps {
  onNewGame: () => void;
  onResign: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
}

const Controls = ({ onNewGame, onResign, onUndo, canUndo = false }: ControlsProps) => {
  return (
    <div className="bg-background-light/80 dark:bg-background-dark/90 backdrop-blur-sm p-4 rounded-xl border border-primary/20">
      <div className="flex flex-col gap-3">
        <button 
          onClick={onNewGame}
          className="w-full flex items-center justify-center px-6 py-3 text-sm sm:text-base font-bold rounded-lg text-white bg-primary hover:bg-opacity-90 transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg"
        >
          New Game
        </button>
        
        {canUndo && onUndo && (
          <button 
            onClick={onUndo}
            className="w-full flex items-center justify-center px-6 py-2.5 border border-primary/20 dark:border-primary/30 text-sm sm:text-base font-medium rounded-lg text-gray-800 dark:text-gray-200 bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30 transition-all"
          >
            ↩️ Undo Move
          </button>
        )}
        
        <button 
          onClick={onResign}
          className="w-full flex items-center justify-center px-6 py-2.5 border border-primary/20 dark:border-primary/30 text-sm sm:text-base font-medium rounded-lg text-gray-800 dark:text-gray-200 bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30 transition-all"
        >
          🏳️ Resign
        </button>
      </div>
    </div>
  );
};

export default Controls;

