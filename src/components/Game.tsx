import { useState, useEffect } from 'react';
import { GameState, Piece, Position, PlayerColor, Move, Board as BoardType } from '../types';
import Board from './Board';
import GameInfo from './GameInfo';
import Controls from './Controls';
import MoveHistory from './MoveHistory';

interface GameProps {
  onBackToMenu: () => void;
}

const Game = ({ onBackToMenu }: GameProps) => {
  const [gameState, setGameState] = useState<GameState>(initializeGame());
  const [turnNumber, setTurnNumber] = useState(1);

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
    if (piece.color !== gameState.currentPlayer) return;
    
    const validMoves = getValidMoves(piece);
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
    
    if (!isValid) return;
    
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
      
      {/* Game Over Modal */}
      {gameState.gameStatus === 'finished' && gameState.winner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background-light dark:bg-background-dark p-8 rounded-xl shadow-2xl max-w-md w-full mx-4">
            <h2 className="text-3xl font-bold text-center mb-4 text-gray-900 dark:text-white">
              Game Over!
            </h2>
            <p className="text-xl text-center mb-6 text-gray-700 dark:text-gray-300">
              <span className="capitalize font-bold">{gameState.winner}</span> player wins! 🎉
            </p>
            <div className="flex gap-4">
              <button
                onClick={handleNewGame}
                className="flex-1 px-6 py-3 bg-primary text-white font-bold rounded-lg hover:bg-opacity-90 transition-all"
              >
                New Game
              </button>
              <button
                onClick={onBackToMenu}
                className="flex-1 px-6 py-3 bg-primary/20 text-gray-800 dark:text-gray-200 font-bold rounded-lg hover:bg-primary/30 transition-all"
              >
                Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Game;

