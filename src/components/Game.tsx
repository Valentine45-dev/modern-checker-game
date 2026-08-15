import { useState, useEffect } from 'react';
import { Trophy, Crown, Repeat, Bot, Sparkles, RotateCcw, ArrowLeft } from 'lucide-react';
import { GameState, Piece, Position, PlayerColor, Move, Board as BoardType, GameMode, PossibleMove } from '../types';
import Board from './Board';
import GameInfo from './GameInfo';
import Controls from './Controls';
import MoveHistory from './MoveHistory';
import { ToastOutlet } from './ToastNotification';
import { useToast } from './toastContext';
import { calculateAIMove, AI_DIFFICULTIES, getAIThinkingMessage, getAIMoveComment, type AIMove } from '../utils/aiEngine';
import { saveGameState, loadGameState, clearGameState, clearAllGameData } from '../utils/gamePersistence';
import { getGameSettings, getAIThinkingTime, updateSoundSettings } from '../utils/gameSettings';
import { soundManager } from '../utils/soundManager';

interface GameProps {
  onBackToMenu: () => void;
  onBackToMenuAfterQuit?: () => void;
  onGameQuit?: () => void;
  gameMode: GameMode;
}

const Game = ({ onBackToMenu, onBackToMenuAfterQuit, onGameQuit, gameMode }: GameProps) => {
  // Load game settings
  const gameSettings = getGameSettings();
  
  // Try to load saved game state first to get the correct game mode
  const savedState = loadGameState();
  const actualGameMode = savedState?.gameMode || gameMode;
  
  // Determine if current player is AI (moved to top for early initialization)
  const isAIGame = actualGameMode !== 'pvp';
  const aiColor: PlayerColor = 'red'; // AI always plays red

  const [gameState, setGameState] = useState<GameState>(() => {
    // Try to load saved game state
    if (savedState && savedState.gameMode === actualGameMode) {
      return savedState;
    }
    return initializeGame();
  });
  const [turnNumber, setTurnNumber] = useState(() => {
    const savedState = loadGameState();
    return savedState?.turnNumber || 1;
  });
  const [gameStartTime] = useState(() => {
    const savedState = loadGameState();
    return savedState?.gameStartTime || Date.now();
  });
  const [kingsPromoted, setKingsPromoted] = useState(() => {
    const savedState = loadGameState();
    return savedState?.kingsPromoted || { red: 0, black: 0 };
  });
  const [multiJumpInProgress, setMultiJumpInProgress] = useState(() => {
    const savedState = loadGameState();
    return savedState?.multiJumpInProgress || false;
  });
  const [currentJumpPiece, setCurrentJumpPiece] = useState<Piece | null>(() => {
    const savedState = loadGameState();
    return savedState?.currentJumpPiece || null;
  });
  const [accumulatedCaptures, setAccumulatedCaptures] = useState<Piece[]>(() => {
    const savedState = loadGameState();
    return savedState?.accumulatedCaptures || [];
  });
  const [aiThinking, setAiThinking] = useState(false);
  const [aiThinkingMessage, setAiThinkingMessage] = useState('');
  const [shakingPieceId, setShakingPieceId] = useState<string | null>(null);
  const [piecesWithCaptures, setPiecesWithCaptures] = useState<Set<string>>(() => {
    const savedState = loadGameState();
    return new Set(savedState?.piecesWithCaptures || []);
  });
  const { addToast, addConfirmDialog } = useToast();

  // Helper function to safely play sounds
  const playSound = (soundFunction: () => void) => {
    try {
      soundFunction();
    } catch (error) {
      console.warn('Failed to play sound:', error);
    }
  };

  // Initialize sound settings
  useEffect(() => {
    try {
      updateSoundSettings(gameSettings.soundEnabled, gameSettings.soundVolume);
    } catch (error) {
      console.warn('Failed to initialize sound settings:', error);
    }
  }, [gameSettings.soundEnabled, gameSettings.soundVolume]);

  // Resume audio context on first user interaction
  useEffect(() => {
    const handleFirstInteraction = () => {
      soundManager.resumeAudioContext();
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
    
    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('keydown', handleFirstInteraction);
    
    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

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
    
    // In AI mode, black (human) starts first. In PvP mode, red starts first.
    const startingPlayer: PlayerColor = isAIGame ? 'black' : 'red';
    
    return {
      board,
      currentPlayer: startingPlayer,
      selectedPiece: null,
      validMoves: [],
      possibleCaptures: [],
      moveHistory: [],
      score: { red: 0, black: 0 },
      capturedPieces: { red: [], black: [] },
      gameStatus: 'playing',
      gameMode: actualGameMode,
      mustCapture: false,
      playerTimers: { red: 300, black: 300 },
      turnStartTime: Date.now(),
    };
  }

  function isValidPosition(row: number, col: number): boolean {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }

  // Check if positions are equal
  function positionsEqual(pos1: Position, pos2: Position): boolean {
    return pos1.row === pos2.row && pos1.col === pos2.col;
  }

  // ============================================
  // FLYING KING LOGIC
  // ============================================
  
  // Get all squares a flying king can reach in one direction
  function getFlyingKingSquares(
    piece: Piece,
    board: BoardType,
    direction: [number, number]
  ): Position[] {
    const squares: Position[] = [];
    const [dRow, dCol] = direction;
    let { row, col } = piece.position;
    
    for (;;) {
      row += dRow;
      col += dCol;
      
      if (!isValidPosition(row, col)) break;
      if (board[row][col]) break; // Blocked by a piece
      
      squares.push({ row, col });
    }
    
    return squares;
  }

  // Get flying king capture moves in one direction
  function getFlyingKingCaptures(
    piece: Piece,
    board: BoardType,
    direction: [number, number],
    capturedSoFar: Piece[] = []
  ): { landingSquares: Position[]; capturedPiece: Piece | null; capturePos: Position | null } {
    const [dRow, dCol] = direction;
    let { row, col } = piece.position;
    let enemyPiece: Piece | null = null;
    let capturePos: Position | null = null;
    
    // Fly until we hit a piece
    for (;;) {
      row += dRow;
      col += dCol;
      
      if (!isValidPosition(row, col)) break;
      
      const square = board[row][col];
      if (square) {
        // Check if it's an enemy piece and not already captured
        if (square.color !== piece.color && 
            !capturedSoFar.some(p => p.id === square.id)) {
          enemyPiece = square;
          capturePos = { row, col };
        }
        break;
      }
    }
    
    // If we found an enemy, continue flying past it to find landing squares
    const landingSquares: Position[] = [];
    if (enemyPiece && capturePos) {
      row = capturePos.row;
      col = capturePos.col;
      
      for (;;) {
        row += dRow;
        col += dCol;
        
        if (!isValidPosition(row, col)) break;
        if (board[row][col]) break;
        
        landingSquares.push({ row, col });
      }
    }
    
    return { landingSquares, capturedPiece: enemyPiece, capturePos };
  }

  // ============================================
  // MOVE CALCULATION - INTERNATIONAL RULES
  // ============================================

  // Calculate all possible captures for a piece (recursive for multi-jumps)
  function getPossibleCaptures(
    piece: Piece,
    board: BoardType,
    capturedSoFar: Piece[] = [],
    currentPos?: Position
  ): PossibleMove[] {
    const pos = currentPos || piece.position;
    const captures: PossibleMove[] = [];
    
    // All 4 diagonal directions (both forward and backward for captures)
    const directions: [number, number][] = [
      [-1, -1], [-1, 1], [1, -1], [1, 1]
    ];

    if (piece.type === 'king') {
      // FLYING KING CAPTURES
      for (const direction of directions) {
        const { landingSquares, capturedPiece, capturePos } = getFlyingKingCaptures(
          { ...piece, position: pos },
          board,
          direction,
          capturedSoFar
        );
        
        if (capturedPiece && capturePos) {
          for (const landing of landingSquares) {
            // Create temporary board for recursive checking
            const tempBoard = board.map(row => [...row]);
            tempBoard[pos.row][pos.col] = null;
            tempBoard[capturePos.row][capturePos.col] = null;
            tempBoard[landing.row][landing.col] = { ...piece, position: landing };
            
            const newCaptured = [...capturedSoFar, capturedPiece];
            
            // Check for continuation captures
            const continuations = getPossibleCaptures(
              { ...piece, position: landing },
              tempBoard,
              newCaptured,
              landing
            );
            
            captures.push({
              position: landing,
              isCapture: true,
              capturedPieces: [capturedPiece],
              continuations: continuations.length > 0 ? continuations : undefined
            });
          }
        }
      }
    } else {
      // NORMAL PIECE CAPTURES (can capture forward AND backward)
      for (const [dRow, dCol] of directions) {
        const jumpRow = pos.row + dRow * 2;
        const jumpCol = pos.col + dCol * 2;
        const midRow = pos.row + dRow;
        const midCol = pos.col + dCol;
        
        if (isValidPosition(jumpRow, jumpCol) && isValidPosition(midRow, midCol)) {
          const middlePiece = board[midRow][midCol];
          const jumpSquare = board[jumpRow][jumpCol];
          
          if (middlePiece && 
              middlePiece.color !== piece.color && 
              !jumpSquare &&
              !capturedSoFar.some(p => p.id === middlePiece.id)) {
            
            // Create temporary board
            const tempBoard = board.map(row => [...row]);
            tempBoard[pos.row][pos.col] = null;
            tempBoard[midRow][midCol] = null;
            tempBoard[jumpRow][jumpCol] = { ...piece, position: { row: jumpRow, col: jumpCol } };
            
            const newCaptured = [...capturedSoFar, middlePiece];
            
            // Check for continuation captures from the landing position
            const continuations = getPossibleCaptures(
              { ...piece, position: { row: jumpRow, col: jumpCol } },
              tempBoard,
              newCaptured,
              { row: jumpRow, col: jumpCol }
            );
            
            captures.push({
              position: { row: jumpRow, col: jumpCol },
              isCapture: true,
              capturedPieces: [middlePiece],
              continuations: continuations.length > 0 ? continuations : undefined
            });
          }
        }
      }
    }
    
    return captures;
  }

  // Get normal (non-capture) moves for a piece
  function getNormalMoves(piece: Piece, board: BoardType): Position[] {
    const moves: Position[] = [];
    const { row, col } = piece.position;
    
    if (piece.type === 'king') {
      // FLYING KING - can move multiple squares in all 4 directions
      const directions: [number, number][] = [
        [-1, -1], [-1, 1], [1, -1], [1, 1]
      ];
      
      for (const direction of directions) {
        moves.push(...getFlyingKingSquares(piece, board, direction));
      }
    } else {
      // NORMAL PIECE - only forward diagonal moves (one square)
      const forwardDir = piece.color === 'red' ? 1 : -1;
      const forwardMoves: [number, number][] = [
        [forwardDir, -1],
        [forwardDir, 1]
      ];
      
      for (const [dRow, dCol] of forwardMoves) {
        const newRow = row + dRow;
        const newCol = col + dCol;
        
        if (isValidPosition(newRow, newCol) && !board[newRow][newCol]) {
          moves.push({ row: newRow, col: newCol });
        }
      }
    }
    
    return moves;
  }

  // Get all valid moves for current player (enforce mandatory capture)
  function getAllValidMovesForPlayer(board: BoardType, player: PlayerColor): {
    captures: Map<string, PossibleMove[]>;
    normalMoves: Map<string, Position[]>;
    mustCapture: boolean;
  } {
    const captures = new Map<string, PossibleMove[]>();
    const normalMoves = new Map<string, Position[]>();
    
    // First, check all pieces for possible captures
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.color === player) {
          const possibleCaptures = getPossibleCaptures(piece, board);
          if (possibleCaptures.length > 0) {
            captures.set(piece.id, possibleCaptures);
          }
        }
      }
    }
    
    // If captures exist, they are mandatory
    const mustCapture = captures.size > 0;
    
    // Only calculate normal moves if no captures are available
    if (!mustCapture) {
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const piece = board[row][col];
          if (piece && piece.color === player) {
            const moves = getNormalMoves(piece, board);
            if (moves.length > 0) {
              normalMoves.set(piece.id, moves);
            }
          }
        }
      }
    }
    
    return { captures, normalMoves, mustCapture };
  }

  // Get valid moves/captures for a specific piece
  function getValidMovesForPiece(piece: Piece): { 
    moves: Position[]; 
    captures: PossibleMove[];
    mustCapture: boolean;
  } {
    const allMoves = getAllValidMovesForPlayer(gameState.board, piece.color);
    
    if (allMoves.mustCapture) {
      const captures = allMoves.captures.get(piece.id) || [];
      return { 
        moves: [], 
        captures, 
        mustCapture: true 
      };
    } else {
      const moves = allMoves.normalMoves.get(piece.id) || [];
      return { 
        moves, 
        captures: [], 
        mustCapture: false 
      };
    }
  }

  // Flatten capture tree to get all possible landing positions
  function flattenCaptureMoves(captures: PossibleMove[]): Position[] {
    const positions: Position[] = [];
    
    for (const capture of captures) {
      positions.push(capture.position);
      
      // If there are continuations, recursively flatten them
      if (capture.continuations && capture.continuations.length > 0) {
        positions.push(...flattenCaptureMoves(capture.continuations));
      }
    }
    
    return positions;
  }

  // ============================================
  // PIECE SELECTION & MOVEMENT
  // ============================================

  // Handle piece selection
  function handlePieceClick(piece: Piece) {
    // Disable interaction when AI is thinking
    if (aiThinking) {
      addToast({
        type: 'info',
        message: '<Bot className="inline-block w-5 h-5 mr-2 align-text-bottom" aria-hidden="true" />AI is thinking...',
        description: 'Please wait for the AI to make its move.',
        duration: 2000,
      });
      return;
    }

    // If in multi-jump, can only select the jumping piece
    if (multiJumpInProgress) {
      if (currentJumpPiece && piece.id === currentJumpPiece.id) {
        const { moves, captures } = getValidMovesForPiece(piece);
        const validPositions = captures.length > 0 ? flattenCaptureMoves(captures) : moves;
        
        setGameState({
          ...gameState,
          selectedPiece: piece,
          validMoves: validPositions,
          possibleCaptures: captures
        });
      }
      return;
    }
    
    if (piece.color !== gameState.currentPlayer) {
      // Trigger shake animation for wrong turn
      setShakingPieceId(piece.id);
      setTimeout(() => setShakingPieceId(null), 500); // Clear after animation
      
        addToast({
          type: 'warning',
          message: 'Wrong Turn!',
          description: `It's ${gameState.currentPlayer} player's turn.`,
          duration: 3000,
        });
        
        // Play invalid move sound
        playSound(() => soundManager.playInvalidMoveSound());
      return;
    }
    
    const { moves, captures, mustCapture } = getValidMovesForPiece(piece);
    
    if (captures.length === 0 && moves.length === 0) {
      // Trigger shake animation
      setShakingPieceId(piece.id);
      setTimeout(() => setShakingPieceId(null), 500); // Clear after animation
      
        addToast({
          type: 'info',
          message: 'No Valid Moves',
          description: 'This piece cannot move. Select another piece.',
          duration: 3000,
        });
        
        // Play invalid move sound
        playSound(() => soundManager.playInvalidMoveSound());
      return;
    }
    
    if (mustCapture && captures.length === 0) {
      // Trigger shake animation for mandatory capture violation
      setShakingPieceId(piece.id);
      setTimeout(() => setShakingPieceId(null), 500); // Clear after animation
      
        addToast({
          type: 'warning',
          message: 'Must Capture!',
          description: 'Another piece has a mandatory capture available.',
          duration: 3000,
        });
        
        // Play invalid move sound
        playSound(() => soundManager.playInvalidMoveSound());
      return;
    }
    
    const validPositions = captures.length > 0 ? flattenCaptureMoves(captures) : moves;
    
    if (mustCapture && captures.length > 0) {
      addToast({
        type: 'info',
        message: 'Capture Available!',
        description: 'You must capture the opponent\'s piece.',
        duration: 3000,
      });
    }
    
    setGameState({
      ...gameState,
      selectedPiece: piece,
      validMoves: validPositions,
      possibleCaptures: captures,
      mustCapture
    });
  }

  // Handle square click to move piece
  function handleSquareClick(position: Position) {
    if (!gameState.selectedPiece) return;
    
    const isValid = gameState.validMoves.some(
      move => positionsEqual(move, position)
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
    
    executeMoveOrCapture(gameState.selectedPiece, position);
  }

  // Execute move or capture
  function executeMoveOrCapture(piece: Piece, newPosition: Position) {
    const captureMove = findCaptureInTree(gameState.possibleCaptures, newPosition);
    
    if (captureMove) {
      executeCapture(piece, newPosition, captureMove);
    } else {
      executeNormalMove(piece, newPosition);
    }
  }

  // Find capture move in the tree
  function findCaptureInTree(captures: PossibleMove[], targetPos: Position): PossibleMove | null {
    for (const capture of captures) {
      if (positionsEqual(capture.position, targetPos)) {
        return capture;
      }
      if (capture.continuations) {
        const found = findCaptureInTree(capture.continuations, targetPos);
        if (found) return found;
      }
    }
    return null;
  }

  // Execute a capture move
  function executeCapture(piece: Piece, newPosition: Position, captureMove: PossibleMove) {
    const newBoard = gameState.board.map(row => [...row]);
    const { row: oldRow, col: oldCol } = piece.position;
    const { row: newRow, col: newCol } = newPosition;
    
    // Add current captured pieces to accumulated list
    const currentCaptures = [...accumulatedCaptures, ...captureMove.capturedPieces];
    
    // Remove captured pieces from THIS jump
    for (const captured of captureMove.capturedPieces) {
      newBoard[captured.position.row][captured.position.col] = null;
    }
    
    // Check for king promotion
    const reachedBackRank =
      (piece.color === 'red' && newRow === 7) || (piece.color === 'black' && newRow === 0);
    const becameKing = reachedBackRank && piece.type !== 'king';

    // Move the piece (promoting it in the same step, so the object is never mutated)
    const movedPiece: Piece = {
      ...piece,
      position: newPosition,
      type: becameKing ? 'king' : piece.type
    };

    if (becameKing) {
      setKingsPromoted(prev => ({
        ...prev,
        [movedPiece.color]: prev[movedPiece.color] + 1
      }));

      addToast({
        type: 'success',
        message: 'King Promoted!',
        description: 'Your piece reached the opposite end and became a King!',
        duration: 4000,
      });

      // Play king promotion sound
      playSound(() => soundManager.playKingPromotionSound());
    }

    newBoard[oldRow][oldCol] = null;
    newBoard[newRow][newCol] = movedPiece;

    // Check if there are continuation captures
    if (captureMove.continuations && captureMove.continuations.length > 0 && !becameKing) {
      // Multi-jump in progress - DON'T update score yet, just accumulate
      setMultiJumpInProgress(true);
      setCurrentJumpPiece(movedPiece);
      setAccumulatedCaptures(currentCaptures);
      
      setGameState({
        ...gameState,
        board: newBoard,
        selectedPiece: movedPiece,
        validMoves: flattenCaptureMoves(captureMove.continuations),
        possibleCaptures: captureMove.continuations,
        score: gameState.score // Don't update score during multi-jump
      });
      
        addToast({
          type: 'info',
          message: `Continue Capturing! (${currentCaptures.length} captured)`,
          description: 'You have more captures available. Keep going!',
          duration: 3000,
        });
        
        // Play multi-jump sound
        playSound(() => soundManager.playMultiJumpSound());
      
      return;
    }
    
    // Capture sequence complete - now update score with ALL captures
    const newScore = { ...gameState.score };
    for (const captured of currentCaptures) {
      if (captured.color === 'red') {
        newScore.black++;
      } else {
        newScore.red++;
      }
    }
    
      // Show final capture notification
      addToast({
        type: 'success',
        message: `Captured ${currentCaptures.length} Piece${currentCaptures.length > 1 ? 's' : ''}!`,
        description: currentCaptures.length > 1 ? 'Multi-jump complete!' : 'Great move!',
        duration: 3000,
      });
      
      // Play capture sound
      playSound(() => soundManager.playCaptureSound());
      
      // Capture sequence complete
      finalizeTurn(newBoard, newScore, piece.position, newPosition, currentCaptures, becameKing);
  }

  // Execute a normal move
  function executeNormalMove(piece: Piece, newPosition: Position) {
    const newBoard = gameState.board.map(row => [...row]);
    const { row: oldRow, col: oldCol } = piece.position;
    const { row: newRow, col: newCol } = newPosition;
    
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
        setKingsPromoted(prev => ({
          ...prev,
          [movedPiece.color]: prev[movedPiece.color] + 1
        }));
        
        addToast({
          type: 'success',
          message: 'King Promoted!',
          description: 'Your piece reached the opposite end and became a King!',
          duration: 4000,
        });
        
        // Play king promotion sound
        playSound(() => soundManager.playKingPromotionSound());
      }
    }
    
      newBoard[oldRow][oldCol] = null;
      newBoard[newRow][newCol] = movedPiece;
      
      // Play move sound
      playSound(() => soundManager.playMoveSound());
      
      finalizeTurn(newBoard, gameState.score, piece.position, newPosition, [], becameKing);
  }

  // Finalize turn and switch player
  function finalizeTurn(
    newBoard: BoardType,
    newScore: { red: number; black: number },
    from: Position,
    to: Position,
    capturedPieces: Piece[],
    becameKing: boolean
  ) {
    // Reset multi-jump state
    setMultiJumpInProgress(false);
    setCurrentJumpPiece(null);
    setAccumulatedCaptures([]);
    
    // Create move record
    const move: Move = {
      from,
      to,
      capturedPieces,
      becameKing,
      timestamp: Date.now()
    };
    
    // Check for win condition
    const winner = checkWinCondition(newBoard, gameState.currentPlayer);
    
    // Switch player
    const nextPlayer: PlayerColor = gameState.currentPlayer === 'red' ? 'black' : 'red';
    
    // No turn-change toast: the "Current Player" card in the sidebar already
    // shows whose turn it is, and firing a toast for every single move was the
    // main source of notification spam over the board.

    // Clear saved game state if game is finished
    if (winner) {
      clearGameState();
    }
    
    setGameState({
      ...gameState,
      board: newBoard,
      currentPlayer: nextPlayer,
      selectedPiece: null,
      validMoves: [],
      possibleCaptures: [],
      moveHistory: [...gameState.moveHistory, move],
      score: newScore,
      gameStatus: winner ? 'finished' : 'playing',
      winner,
      mustCapture: false
    });
    
    setTurnNumber(prev => prev + 1);
  }

  // Check win condition
  function checkWinCondition(board: (Piece | null)[][], lastPlayer: PlayerColor): PlayerColor | undefined {
    const opponentColor: PlayerColor = lastPlayer === 'red' ? 'black' : 'red';
    
    let opponentHasPieces = false;
    let opponentHasMoves = false;
    
    // Check if opponent has any pieces or moves
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.color === opponentColor) {
          opponentHasPieces = true;
          
          // Check if this piece has any valid moves
          const captures = getPossibleCaptures(piece, board);
          const normalMoves = getNormalMoves(piece, board);
          
          if (captures.length > 0 || normalMoves.length > 0) {
            opponentHasMoves = true;
            break;
          }
        }
      }
      if (opponentHasMoves) break;
    }
    
    if (!opponentHasPieces || !opponentHasMoves) {
      const winnerName = lastPlayer === 'red' 
        ? (isAIGame ? 'AI' : 'Red player') 
        : 'Black player';
      addToast({
        type: 'success',
        message: 'Game Over!',
        description: `${winnerName} wins!`,
        duration: 5000,
      });
      return lastPlayer;
    }
    
    return undefined;
  }

  // Update pieces with captures available
  useEffect(() => {
    if (gameState.gameStatus !== 'playing' || multiJumpInProgress) return;

    const capturesMap = new Set<string>();
    const allMoves = getAllValidMovesForPlayer(gameState.board, gameState.currentPlayer);
    
    // If there are mandatory captures, highlight those pieces
    if (allMoves.mustCapture) {
      allMoves.captures.forEach((_, pieceId) => {
        capturesMap.add(pieceId);
      });
    }
    
    setPiecesWithCaptures(capturesMap);
    // getAllValidMovesForPlayer is re-created on every render, so listing it here
    // would re-run this effect (and setState) on every render. The real fix is to
    // move the rules out of this component into a stable module.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.board, gameState.currentPlayer, gameState.gameStatus, multiJumpInProgress]);

    // Auto-save game state after each move
    useEffect(() => {
      if (gameState.gameStatus === 'playing' && gameSettings.autoSave) {
        saveGameState(
          gameState,
          turnNumber,
          gameStartTime,
          kingsPromoted,
          multiJumpInProgress,
          currentJumpPiece,
          accumulatedCaptures,
          aiThinking,
          piecesWithCaptures
        ).catch(error => {
          console.warn('Failed to auto-save game:', error);
        });
      }
    }, [gameState, turnNumber, gameStartTime, kingsPromoted, multiJumpInProgress, currentJumpPiece, accumulatedCaptures, aiThinking, piecesWithCaptures, gameSettings.autoSave]);

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
    // The tick reads the timers through the setState updater, so it does not need
    // gameState.playerTimers as a dependency (adding it would restart the interval
    // every second).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.currentPlayer, gameState.gameStatus]);

  // AI Move Logic
  useEffect(() => {
    // Early exit checks (but allow multi-jump continuation)
    if (!isAIGame || 
        gameState.gameStatus !== 'playing') {
      return;
    }

    // Check if it's AI's turn OR if AI is in the middle of a multi-jump
    const isAITurn = gameState.currentPlayer === aiColor;
    const isAIMultiJump = multiJumpInProgress && currentJumpPiece?.color === aiColor;

    if (!isAITurn && !isAIMultiJump) {
      return;
    }

    // Don't trigger if already thinking (prevents duplicate calls)
    if (aiThinking) {
      return;
    }

      const difficulty = AI_DIFFICULTIES[actualGameMode];
      if (!difficulty) {
        console.error('AI difficulty not found for gameMode:', actualGameMode);
        return;
      }

      // Adjust AI thinking time based on settings
      const adjustedThinkingTime = getAIThinkingTime(
        difficulty.thinkingTime, 
        gameSettings.aiDifficulty, 
        gameSettings.gameSpeed
      );

    console.log('AI Move Logic Triggered', {
      isAITurn,
      isAIMultiJump,
      currentPlayer: gameState.currentPlayer,
      aiColor,
      multiJumpInProgress,
      currentJumpPiece: currentJumpPiece?.id
    });

    // Show thinking state. No toast here on purpose — the board already renders
    // an "AI is thinking..." banner, and a toast saying the same thing was just
    // extra noise stacking up over the game.
    setAiThinking(true);
    setAiThinkingMessage(getAIThinkingMessage(actualGameMode));

    // Calculate and execute AI move after thinking time
    const timer = setTimeout(() => {
      try {
        console.log('🤖 setTimeout executing...');
        let aiMove: AIMove | null = null;

        // Handle multi-jump continuation
        if (isAIMultiJump && currentJumpPiece) {
          console.log('🤖 AI continuing multi-jump');
          
          // Get valid continuation moves for the jumping piece
          const { captures } = getValidMovesForPiece(currentJumpPiece);
          
          if (captures.length > 0) {
            // Choose the best continuation (for now, just pick the first one)
            // In a more advanced version, evaluate each continuation
            const bestCapture = captures[0];
            
            aiMove = {
              piece: currentJumpPiece,
              targetPosition: bestCapture.position,
              captureMove: bestCapture,
              score: 0,
              depth: 0
            };
            
            console.log('🤖 AI chose multi-jump continuation:', aiMove);
          } else {
            console.error('🤖 AI multi-jump has no continuations available!');
            setMultiJumpInProgress(false);
            setCurrentJumpPiece(null);
            setAiThinking(false);
            return;
          }
        } else {
          // Normal AI move calculation
          console.log('🤖 AI calculating normal move, board:', gameState.board);
          console.log('🤖 AI color:', aiColor);
          console.log('🤖 Difficulty:', difficulty);
          
          aiMove = calculateAIMove(gameState.board, aiColor, difficulty);
          console.log('🤖 AI calculated move:', aiMove);
        }
      
      if (aiMove) {
        // Find the actual piece on the board
        const piece = gameState.board[aiMove.piece.position.row][aiMove.piece.position.col];
        if (piece) {
          console.log('🤖 AI executing move from', aiMove.piece.position, 'to', aiMove.targetPosition);
          
          // Execute the move
          if (aiMove.captureMove) {
            executeCapture(piece, aiMove.targetPosition, aiMove.captureMove);
          } else {
            executeNormalMove(piece, aiMove.targetPosition);
          }

          // Show AI move comment
          const captureCount = aiMove.captureMove 
            ? aiMove.captureMove.capturedPieces.length 
            : 0;
          const becameKing = (aiMove.piece.color === 'red' && aiMove.targetPosition.row === 7) ||
                            (aiMove.piece.color === 'black' && aiMove.targetPosition.row === 0);
          const comment = getAIMoveComment(captureCount, becameKing, actualGameMode);
          
            setTimeout(() => {
              addToast({
                type: 'success',
                message: 'AI Move',
                description: comment,
                duration: 3000,
              });
            }, 300);
            
            // Play AI move sound
            playSound(() => soundManager.playAIMoveSound());
        } else {
          console.error('🤖 AI piece not found on board at position:', aiMove.piece.position);
        }
      } else {
        console.error('🤖 AI could not calculate a move!');
      }
      
      setAiThinking(false);
      } catch (error) {
        console.error('🤖 AI Error:', error);
        setAiThinking(false);
      }
      }, adjustedThinkingTime);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.currentPlayer, gameState.gameStatus, multiJumpInProgress]);

  // Handle new game
  function handleNewGame() {
    // Clear any saved game state
    clearGameState();
    
    setGameState(initializeGame());
    setTurnNumber(1);
    setKingsPromoted({ red: 0, black: 0 });
    setMultiJumpInProgress(false);
    setCurrentJumpPiece(null);
    setAccumulatedCaptures([]);
    setAiThinking(false);
    setPiecesWithCaptures(new Set());
  }

  // Handle rematch
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

  // Get victory message (based on how lopsided the final score was)
  function getVictoryMessage(): string {
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

    // Handle quit game
    function handleQuit() {
      // Show custom confirmation dialog
      addConfirmDialog({
        message: 'Quit Game?',
        description: 'This will clear all saved game data and return to the main menu. This action cannot be undone.',
        confirmText: 'Quit',
        cancelText: 'Cancel',
        onConfirm: () => {
          // Clear all localStorage data
          clearAllGameData();
          
          // Notify parent component that game was quit
          onGameQuit?.();
          
          // Show confirmation toast
          addToast({
            type: 'info',
            message: 'Game Quit',
            description: 'All game data has been cleared. Returning to menu.',
            duration: 3000,
          });
          
          // Return to menu immediately (no delay needed since localStorage is cleared)
          onBackToMenuAfterQuit?.() || onBackToMenu();
        },
        onCancel: () => {
          // User cancelled, do nothing
          addToast({
            type: 'info',
            message: 'Game Continued',
            description: 'You can continue playing.',
            duration: 2000,
          });
        }
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
              validMoves={gameSettings.showMoveHints ? gameState.validMoves : []}
              onSquareClick={handleSquareClick}
              onPieceClick={handlePieceClick}
              shakingPieceId={shakingPieceId}
              piecesWithCaptures={gameSettings.showCaptures ? piecesWithCaptures : new Set()}
            />
          
          {/* Multi-jump indicator */}
          {multiJumpInProgress && (
            <div className="mt-4 p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg backdrop-blur-sm">
              <p className="text-yellow-300 font-semibold text-center">
                <Repeat className="inline-block w-5 h-5 mr-2 align-text-bottom" aria-hidden="true" />Multi-Jump in Progress - Continue capturing!
              </p>
            </div>
          )}

          {/* AI Thinking indicator */}
          {aiThinking && (
            <div className="mt-4 p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg backdrop-blur-sm animate-pulse">
              <p className="text-blue-300 font-semibold text-center">
                <Bot className="inline-block w-5 h-5 mr-2 align-text-bottom" aria-hidden="true" />
                AI is thinking...
              </p>
              {aiThinkingMessage && (
                <p className="text-blue-200/70 text-sm text-center mt-1">
                  {aiThinkingMessage}
                </p>
              )}
            </div>
          )}
        </div>
        
        {/* Sidebar */}
        <div className="w-full lg:w-96 lg:flex-shrink-0 space-y-4">
          {/* Toasts dock here on wide screens so they never sit over the board */}
          <ToastOutlet />

          <GameInfo
            currentPlayer={gameState.currentPlayer}
            turnNumber={turnNumber}
            capturedPieces={gameState.score}
            timer={gameState.playerTimers || { red: 300, black: 300 }}
            gameMode={actualGameMode}
          />
          
          <MoveHistory moves={gameState.moveHistory} maxDisplay={5} />
          
          <Controls 
            onNewGame={handleNewGame} 
            onResign={handleResign} 
            onQuit={handleQuit}
            canUndo={false} 
          />
          
          <button
            onClick={onBackToMenu}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-primary/5"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />Back to Menu
          </button>
        </div>
      </div>
      
      {/* Game Over Modal */}
      {gameState.gameStatus === 'finished' && gameState.winner && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-background-light dark:bg-background-dark rounded-2xl shadow-2xl max-w-lg w-full mx-4 my-8 max-h-[85vh] overflow-y-auto border border-primary/30">
            {/* Header with Trophy */}
            <div className="relative bg-gradient-to-br from-yellow-500/20 via-yellow-600/20 to-orange-500/20 p-6 text-center border-b border-primary/20">
              <div className="flex justify-center mb-3">
                <div className="p-3 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-lg">
                  {/* Was the same 5-pointed star path used for the "king crown" */}
                  <Trophy className="w-10 h-10 text-white" aria-hidden="true" />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {gameState.winner === 'red' 
                  ? (isAIGame ? 'AI' : 'Red') 
                  : 'Black'} Wins!
              </h2>
              <p className="text-base text-gray-600 dark:text-gray-400 mb-1">
                {getVictoryMessage()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Congratulations, you have successfully conquered the board.
              </p>
            </div>

            {/* Game Statistics */}
            <div className="p-4 space-y-3">
              {/* Performance Rating */}
              <div className="text-center p-2 bg-primary/5 dark:bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-base font-bold text-gray-900 dark:text-white">
                  {getPerformanceRating(gameState.winner)}
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-2">
                {/* Total Moves */}
                <div className="bg-primary/5 dark:bg-primary/10 p-3 rounded-lg border border-primary/20">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Moves</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{gameState.moveHistory.length}</p>
                </div>

                {/* Time Taken */}
                <div className="bg-primary/5 dark:bg-primary/10 p-3 rounded-lg border border-primary/20">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Time Taken</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{getGameDuration()}</p>
                </div>
              </div>

              {/* Pieces Captured */}
              <div className="bg-primary/5 dark:bg-primary/10 p-3 rounded-lg border border-primary/20">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Pieces Captured</p>
                <div className="flex justify-around">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-red-600 border-2 border-red-800" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Red</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{gameState.score.red}</p>
                    </div>
                  </div>
                  <div className="w-px bg-primary/20"></div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Black</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{gameState.score.black}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Kings Promoted */}
              <div className="bg-primary/5 dark:bg-primary/10 p-3 rounded-lg border border-primary/20">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Kings Promoted</p>
                <div className="flex justify-around">
                  <div className="text-center">
                    <p className="flex justify-center text-yellow-500"><Crown className="w-6 h-6" aria-hidden="true" /></p>
                    <p className="text-base font-bold text-gray-900 dark:text-white">{kingsPromoted.red}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Red</p>
                  </div>
                  <div className="text-center">
                    <p className="flex justify-center text-yellow-500"><Crown className="w-6 h-6" aria-hidden="true" /></p>
                    <p className="text-base font-bold text-gray-900 dark:text-white">{kingsPromoted.black}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Black</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={handleRematch}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-6 font-bold text-white bg-primary hover:bg-primary/90 rounded-lg transition-all duration-300 transform hover:scale-[1.02] shadow-lg"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />Rematch
                </button>
                <button
                  onClick={handleNewGame}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-6 font-bold text-gray-800 dark:text-white bg-primary/20 dark:bg-primary/30 hover:bg-primary/30 dark:hover:bg-primary/40 rounded-lg transition-all duration-300"
                >
                  <Sparkles className="w-4 h-4" aria-hidden="true" />New Game
                </button>
                <button
                  onClick={onBackToMenu}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-6 font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30 rounded-lg transition-all duration-300"
                >
                  <ArrowLeft className="w-4 h-4" aria-hidden="true" />Return to Menu
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
