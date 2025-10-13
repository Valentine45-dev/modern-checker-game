import { useState, useEffect } from 'react';
import { GameState, Piece, Position, PlayerColor, Move, Board as BoardType, GameMode } from '../types';
import Board from './Board';
import GameInfo from './GameInfo';
import Controls from './Controls';
import MoveHistory from './MoveHistory';
import { useToast } from './ToastNotification';

interface GameProps {
  onBackToMenu: () => void;
  gameMode: GameMode;
}

const Game = ({ onBackToMenu, gameMode }: GameProps) => {
  const [gameState, setGameState] = useState<GameState>(initializeGame());
  const [turnNumber, setTurnNumber] = useState(1);
  const [gameStartTime] = useState(Date.now());
  const [kingsPromoted, setKingsPromoted] = useState({ red: 0, black: 0 });
  const { addToast } = useToast();

  // Initialize the board with pieces
  function initializeGame(): GameState {
    const board: BoardType = Array(8).fill(null).map(() => Array(8).fill(null));
    
    // Place red pieces (top 3 rows)
    let pieceId = 1;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) {
          board[row][col] = {
            id: `red-${pieceId++}`,
            color: 'red',
            type: 'normal',
            position: { row, col }
          };
        }
      }
    }
    
    // Place black pieces (bottom 3 rows)
    pieceId = 1;
    for (let row = 5; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) {
          board[row][col] = {
            id: `black-${pieceId++}`,
            color: 'black',
            type: 'normal',
            position: { row, col }
          };
        }
      }
    }
    
    return {
      board,
      currentPlayer: 'red',
      selectedPiece: null,
      validMoves: [],
      possibleCaptures: [],
      moveHistory: [],
      score: { red: 0, black: 0 },
      capturedPieces: { red: [], black: [] },
      gameStatus: 'playing',
      gameMode: 'pvp',
      mustCapture: false,
      playerTimers: { red: 300, black: 300 },
      turnStartTime: Date.now(),
    };
  }

  // Calculate valid moves for a piece
  function getValidMoves(piece: Piece): Position[] {
    const moves: Position[] = [];
    const { row, col } = piece.position;
    const direction = piece.color === 'red' ? 1 : -1;
    
    // Normal forward moves
    const forwardDirections = piece.type === 'king' 
      ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] 
      : [[direction, -1], [direction, 1]];
    
    for (const [dRow, dCol] of forwardDirections) {
      const newRow = row + dRow;
      const newCol = col + dCol;
      
      if (isValidPosition(newRow, newCol) && !gameState.board[newRow][newCol]) {
        moves.push({ row: newRow, col: newCol });
      }
    }
    
    // Capture moves (check all 4 directions for kings, 2 for normal)
    const captureDirections = piece.type === 'king'
      ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
      : [[direction, -1], [direction, 1]];
    
    for (const [dRow, dCol] of captureDirections) {
      const jumpRow = row + dRow * 2;
      const jumpCol = col + dCol * 2;
      const midRow = row + dRow;
      const midCol = col + dCol;
      
      if (isValidPosition(jumpRow, jumpCol) && 
          isValidPosition(midRow, midCol)) {
        const middlePiece = gameState.board[midRow][midCol];
        const jumpSquare = gameState.board[jumpRow][jumpCol];
        
        if (middlePiece && middlePiece.color !== piece.color && !jumpSquare) {
          moves.push({ row: jumpRow, col: jumpCol });
        }
      }
    }
    
    return moves;
  }

  function isValidPosition(row: number, col: number): boolean {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }

  // Handle piece selection
  function handlePieceClick(piece: Piece) {
    if (piece.color !== gameState.currentPlayer) {
      addToast({
        type: 'warning',
        message: 'Wrong Turn!',
        description: `It's ${gameState.currentPlayer} player's turn.`,
        duration: 3000,
      });
      return;
    }
    
    const validMoves = getValidMoves(piece);
    
    if (validMoves.length === 0) {
      addToast({
        type: 'info',
        message: 'No Valid Moves',
        description: 'This piece cannot move. Select another piece.',
        duration: 3000,
      });
      return;
    }
    
    setGameState({
      ...gameState,
      selectedPiece: piece,
      validMoves
    });
  }

  // Handle square click to move piece
  function handleSquareClick(position: Position) {
    if (!gameState.selectedPiece) return;
    
    const isValid = gameState.validMoves.some(
      move => move.row === position.row && move.col === position.col
    );
    
    if (!isValid) {
      addToast({
        type: 'error',
        message: 'Invalid Move',
        description: 'You cannot move to this position. Select a highlighted square.',
        duration: 3000,
      });
      return;
    }
    
    movePiece(gameState.selectedPiece, position);
  }

  // Move piece and update game state
  function movePiece(piece: Piece, newPosition: Position) {
    const newBoard = gameState.board.map(row => [...row]);
    const { row: oldRow, col: oldCol } = piece.position;
    const { row: newRow, col: newCol } = newPosition;
    
    // Check if this is a capture move
    const rowDiff = Math.abs(newRow - oldRow);
    let capturedPiece: Piece | undefined;
    
    if (rowDiff === 2) {
      const midRow = (oldRow + newRow) / 2;
      const midCol = (oldCol + newCol) / 2;
      capturedPiece = newBoard[midRow][midCol] || undefined;
      newBoard[midRow][midCol] = null;
      
      // Show capture notification
      addToast({
        type: 'success',
        message: '⚔️ Piece Captured!',
        description: `You captured ${capturedPiece?.color} player's piece!`,
        duration: 3000,
      });
    }
    
    // Move the piece
    const movedPiece: Piece = {
      ...piece,
      position: newPosition
    };
    
    // Check for king promotion
    let becameKing = false;
    if ((movedPiece.color === 'red' && newRow === 7) || 
        (movedPiece.color === 'black' && newRow === 0)) {
      if (movedPiece.type !== 'king') {
        movedPiece.type = 'king';
        becameKing = true;
        // Track kings promoted
        setKingsPromoted(prev => ({
          ...prev,
          [movedPiece.color]: prev[movedPiece.color] + 1
        }));
        
        // Show king promotion notification
        addToast({
          type: 'success',
          message: '👑 King Promoted!',
          description: 'Your piece reached the opposite end and became a King!',
          duration: 4000,
        });
      }
    }
    
    newBoard[oldRow][oldCol] = null;
    newBoard[newRow][newCol] = movedPiece;
    
    // Update score if piece was captured
    const newScore = { ...gameState.score };
    if (capturedPiece) {
      if (capturedPiece.color === 'red') {
        newScore.red++;
      } else {
        newScore.black++;
      }
    }
    
    // Create move record
    const move: Move = {
      from: piece.position,
      to: newPosition,
      capturedPieces: capturedPiece ? [capturedPiece] : [],
      becameKing,
      timestamp: Date.now()
    };
    
    // Check for win condition
    const winner = checkWinCondition(newBoard, gameState.currentPlayer);
    
    // Switch player
    const nextPlayer: PlayerColor = gameState.currentPlayer === 'red' ? 'black' : 'red';
    
    // Show turn change notification (only if no capture to avoid notification spam)
    if (!capturedPiece && !winner) {
      setTimeout(() => {
        addToast({
          type: 'info',
          message: `${nextPlayer === 'red' ? 'Red' : 'Black'} Player's Turn`,
          description: 'Make your move!',
          duration: 2000,
        });
      }, 500);
    }
    
    setGameState({
      ...gameState,
      board: newBoard,
      currentPlayer: nextPlayer,
      selectedPiece: null,
      validMoves: [],
      moveHistory: [...gameState.moveHistory, move],
      score: newScore,
      gameStatus: winner ? 'finished' : 'playing',
      winner
    });
    
    setTurnNumber(prev => prev + 1);
  }

  // Check win condition
  function checkWinCondition(board: (Piece | null)[][], lastPlayer: PlayerColor): PlayerColor | undefined {
    const opponentColor: PlayerColor = lastPlayer === 'red' ? 'black' : 'red';
    
    let opponentHasPieces = false;
    let opponentHasMoves = false;
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.color === opponentColor) {
          opponentHasPieces = true;
          // Check if this piece has any valid moves
          const moves = getValidMovesForPiece(piece, board);
          if (moves.length > 0) {
            opponentHasMoves = true;
            break;
          }
        }
      }
      if (opponentHasMoves) break;
    }
    
    if (!opponentHasPieces || !opponentHasMoves) {
      return lastPlayer;
    }
    
    return undefined;
  }

  // Helper to get valid moves for a specific piece and board state
  function getValidMovesForPiece(piece: Piece, board: (Piece | null)[][]): Position[] {
    const moves: Position[] = [];
    const { row, col } = piece.position;
    const direction = piece.color === 'red' ? 1 : -1;
    
    const directions = piece.type === 'king' 
      ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] 
      : [[direction, -1], [direction, 1]];
    
    for (const [dRow, dCol] of directions) {
      const newRow = row + dRow;
      const newCol = col + dCol;
      
      if (isValidPosition(newRow, newCol) && !board[newRow][newCol]) {
        moves.push({ row: newRow, col: newCol });
      }
      
      // Check captures
      const jumpRow = row + dRow * 2;
      const jumpCol = col + dCol * 2;
      const midRow = row + dRow;
      const midCol = col + dCol;
      
      if (isValidPosition(jumpRow, jumpCol) && isValidPosition(midRow, midCol)) {
        const middlePiece = board[midRow][midCol];
        const jumpSquare = board[jumpRow][jumpCol];
        
        if (middlePiece && middlePiece.color !== piece.color && !jumpSquare) {
          moves.push({ row: jumpRow, col: jumpCol });
        }
      }
    }
    
    return moves;
  }

  // Timer countdown
  useEffect(() => {
    if (gameState.gameStatus !== 'playing' || !gameState.playerTimers) return;
    
    const interval = setInterval(() => {
      setGameState(prev => ({
        ...prev,
        playerTimers: {
          ...prev.playerTimers!,
          [prev.currentPlayer]: Math.max(0, prev.playerTimers![prev.currentPlayer] - 1)
        }
      }));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [gameState.currentPlayer, gameState.gameStatus]);

  // Handle new game
  function handleNewGame() {
    setGameState(initializeGame());
    setTurnNumber(1);
    setKingsPromoted({ red: 0, black: 0 });
  }

  // Handle rematch (keep same mode)
  function handleRematch() {
    handleNewGame();
  }

  // Calculate game duration
  function getGameDuration(): string {
    const duration = Math.floor((Date.now() - gameStartTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // Get victory message
  function getVictoryMessage(winner: PlayerColor): string {
    const scoreDiff = Math.abs(gameState.score.red - gameState.score.black);
    if (scoreDiff >= 8) return 'Decisive Victory!';
    if (scoreDiff >= 5) return 'Dominant Performance!';
    if (scoreDiff >= 3) return 'Well Played!';
    return 'Close Match!';
  }

  // Get performance rating
  function getPerformanceRating(winner: PlayerColor): string {
    const moveCount = gameState.moveHistory.length;
    const captures = gameState.score[winner];
    
    if (captures >= 10 && moveCount < 30) return 'Excellent Play! 🌟';
    if (captures >= 8) return 'Great Performance! 🎯';
    if (captures >= 5) return 'Good Effort! 👍';
    return 'Nice Try! 💪';
  }

  // Handle resign
  function handleResign() {
    const winner: PlayerColor = gameState.currentPlayer === 'red' ? 'black' : 'red';
    setGameState({
      ...gameState,
      gameStatus: 'finished',
      winner
    });
  }

  return (
    <main className="flex-grow flex items-center justify-center py-4 sm:py-8 px-2 sm:px-4 lg:px-8">
      <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-start justify-center gap-4 sm:gap-6 lg:gap-8">
        {/* Board */}
        <div className="w-full lg:flex-1 max-w-3xl">
          <Board
            board={gameState.board}
            selectedPiece={gameState.selectedPiece}
            validMoves={gameState.validMoves}
            onSquareClick={handleSquareClick}
            onPieceClick={handlePieceClick}
          />
        </div>
        
        {/* Sidebar */}
        <div className="w-full lg:w-96 lg:flex-shrink-0 space-y-4">
          <GameInfo
            currentPlayer={gameState.currentPlayer}
            turnNumber={turnNumber}
            capturedPieces={gameState.score}
            timer={gameState.playerTimers || { red: 300, black: 300 }}
            gameMode={gameMode}
          />
          
          <MoveHistory moves={gameState.moveHistory} maxDisplay={5} />
          
          <Controls
            onNewGame={handleNewGame}
            onResign={handleResign}
            canUndo={false}
          />
          
          <button
            onClick={onBackToMenu}
            className="w-full px-6 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-primary/5"
          >
            ← Back to Menu
          </button>
        </div>
      </div>
      
      {/* Enhanced Game Over Modal */}
      {gameState.gameStatus === 'finished' && gameState.winner && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-background-light dark:bg-background-dark rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden border border-primary/30">
            {/* Header with Trophy */}
            <div className="relative bg-gradient-to-br from-yellow-500/20 via-yellow-600/20 to-orange-500/20 p-8 text-center border-b border-primary/20">
              <div className="flex justify-center mb-4">
                <div className="p-4 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-lg">
                  <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L15 9L22 9L17 14L19 21L12 17L5 21L7 14L2 9L9 9L12 2Z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                You Won!
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
                {getVictoryMessage(gameState.winner)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Congratulations, you have successfully conquered the board.
              </p>
            </div>

            {/* Game Statistics */}
            <div className="p-6 space-y-4">
              {/* Performance Rating */}
              <div className="text-center p-3 bg-primary/5 dark:bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {getPerformanceRating(gameState.winner)}
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Total Moves */}
                <div className="bg-primary/5 dark:bg-primary/10 p-4 rounded-lg border border-primary/20">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Moves</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{gameState.moveHistory.length}</p>
                </div>

                {/* Time Taken */}
                <div className="bg-primary/5 dark:bg-primary/10 p-4 rounded-lg border border-primary/20">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Time Taken</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{getGameDuration()}</p>
                </div>
              </div>

              {/* Pieces Captured */}
              <div className="bg-primary/5 dark:bg-primary/10 p-4 rounded-lg border border-primary/20">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Pieces Captured</p>
                <div className="flex justify-around">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-red-600 border-2 border-red-800" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">You</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{gameState.score.red}</p>
                    </div>
                  </div>
                  <div className="w-px bg-primary/20"></div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Opponent</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{gameState.score.black}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Kings Promoted */}
              <div className="bg-primary/5 dark:bg-primary/10 p-4 rounded-lg border border-primary/20">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Kings Promoted</p>
                <div className="flex justify-around">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-500">👑</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{kingsPromoted.red}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Red</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-500">👑</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{kingsPromoted.black}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Black</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <button
                  onClick={handleRematch}
                  className="w-full py-3 px-6 font-bold text-white bg-primary hover:bg-primary/90 rounded-lg transition-all duration-300 transform hover:scale-[1.02] shadow-lg"
                >
                  🔄 Rematch
                </button>
                <button
                  onClick={handleNewGame}
                  className="w-full py-3 px-6 font-bold text-gray-800 dark:text-white bg-primary/20 dark:bg-primary/30 hover:bg-primary/30 dark:hover:bg-primary/40 rounded-lg transition-all duration-300"
                >
                  ✨ New Game
                </button>
                <button
                  onClick={onBackToMenu}
                  className="w-full py-3 px-6 font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30 rounded-lg transition-all duration-300"
                >
                  ← Return to Menu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Game;

