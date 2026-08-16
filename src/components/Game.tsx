import { useState, useEffect, useRef } from 'react';
import { Trophy, Crown, Repeat, Bot, Sparkles, RotateCcw, ArrowLeft } from 'lucide-react';
import { GameState, Piece, Position, PlayerColor, Move, Board as BoardType, GameMode, PossibleMove } from '../types';
import Board from './Board';
import GameInfo from './GameInfo';
import Controls from './Controls';
import MoveHistory from './MoveHistory';
import { ToastOutlet } from './ToastNotification';
import { useToast } from './toastContext';
import { AI_DIFFICULTIES, getAIThinkingMessage, getAIMoveComment } from '../utils/aiEngine';
import { requestAIMove } from '../utils/aiClient';
import { saveGameState, loadGameState, clearGameState, clearAllGameData } from '../utils/gamePersistence';
import { getGameSettings, getAIThinkingTime, updateSoundSettings } from '../utils/gameSettings';
import { soundManager } from '../utils/soundManager';
import {
  createInitialBoard,
  getPossibleCaptures,
  getNormalMoves,
  getAllValidMovesForPlayer,
  resolveCapturePath,
  captureDestinations,
  type ResolvedCapturePath,
  positionsEqual,
  promotionRow,
  opponentOf,
} from '../utils/rules';

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
  // Where the current capture chain began. Without this the move history
  // records a multi-jump as starting at its LAST hop, so a chain from 1,1 to
  // 7,7 would read "5,5 -> 7,7".
  const [chainOrigin, setChainOrigin] = useState<Position | null>(() => {
    const savedState = loadGameState();
    return savedState?.chainOrigin || null;
  });
  const [aiThinking, setAiThinking] = useState(false);
  const [aiThinkingMessage, setAiThinkingMessage] = useState('');
  // Remaining hops of the capture chain the search picked, so the UI replays
  // exactly that sequence instead of re-choosing at each jump.
  const [aiPlannedPath, setAiPlannedPath] = useState<Position[]>([]);
  const [shakingPieceId, setShakingPieceId] = useState<string | null>(null);
  // The game ends the instant the winning move lands, but the modal waits a
  // moment so the player can actually watch that move — particularly a capture
  // chain, which is exactly when the finish is most worth seeing.
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [piecesWithCaptures, setPiecesWithCaptures] = useState<Set<string>>(() => {
    const savedState = loadGameState();
    return new Set(savedState?.piecesWithCaptures || []);
  });
  const { addToast, addConfirmDialog } = useToast();

  // Latest state, for effects that need to read it without re-running when it
  // changes (the clock replaces gameState every second).
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

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
    const board: BoardType = createInitialBoard();

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

  // ============================================
  // PIECE SELECTION & MOVEMENT
  // ============================================

  // Handle piece selection
  function handlePieceClick(piece: Piece) {
    // Disable interaction when AI is thinking
    if (aiThinking) {
      addToast({
        type: 'info',
        message: 'AI is thinking...',
        description: 'Please wait for the AI to make its move.',
        duration: 2000,
      });
      return;
    }

    // If in multi-jump, can only select the jumping piece
    if (multiJumpInProgress) {
      if (currentJumpPiece && piece.id === currentJumpPiece.id) {
        const { moves, captures } = getValidMovesForPiece(piece);
        const validPositions = captures.length > 0 ? captureDestinations(captures, piece) : moves;
        
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
    
    const validPositions = captures.length > 0 ? captureDestinations(captures, piece) : moves;
    
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
    const resolved = resolveCapturePath(gameState.possibleCaptures, piece, newPosition);

    if (resolved) {
      executeCapture(piece, newPosition, resolved);
    } else {
      executeNormalMove(piece, newPosition);
    }
  }

  /**
   * Execute a capture up to `newPosition`.
   *
   * `resolved` carries every piece taken along the way, which is what makes
   * jumping straight to the end of a chain equivalent to clicking each landing
   * square in turn. Acting on a single tree node instead would move the piece
   * the whole distance while removing only the last victim.
   */
  function executeCapture(piece: Piece, newPosition: Position, resolved: ResolvedCapturePath) {
    const newBoard = gameState.board.map(row => [...row]);
    const { row: oldRow, col: oldCol } = piece.position;
    const { row: newRow, col: newCol } = newPosition;

    // Everything taken on the way here, plus anything from earlier hops
    const currentCaptures = [...accumulatedCaptures, ...resolved.captured];

    // The square this whole sequence started from, so the move history shows
    // the real origin rather than the last hop's square.
    const origin = chainOrigin ?? piece.position;

    // Remove every piece captured along the resolved path
    for (const captured of resolved.captured) {
      newBoard[captured.position.row][captured.position.col] = null;
    }

    // Check for king promotion
    const reachedBackRank =
      newRow === promotionRow(piece.color);
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

    // More jumps available from where the piece landed? `endsTurn` already
    // accounts for promotion, so a man that just crowned stops here.
    const continuations = resolved.node.continuations;
    if (!resolved.endsTurn && continuations && continuations.length > 0 && !becameKing) {
      // Multi-jump in progress - DON'T update score yet, just accumulate
      setMultiJumpInProgress(true);
      setCurrentJumpPiece(movedPiece);
      setAccumulatedCaptures(currentCaptures);
      setChainOrigin(origin);

      setGameState({
        ...gameState,
        board: newBoard,
        selectedPiece: movedPiece,
        validMoves: captureDestinations(continuations, movedPiece),
        possibleCaptures: continuations,
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
      finalizeTurn(newBoard, newScore, origin, newPosition, currentCaptures, becameKing);
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
    if (newRow === promotionRow(movedPiece.color)) {
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
    setChainOrigin(null);
    
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
    const nextPlayer: PlayerColor = opponentOf(gameState.currentPlayer);
    
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
    const opponentColor: PlayerColor = opponentOf(lastPlayer);
    
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

  // Hold the game-over modal back so the final move is visible first.
  useEffect(() => {
    if (gameState.gameStatus !== 'finished' || !gameState.winner) {
      setShowGameOverModal(false);
      return;
    }

    const delay = gameSettings.animationsEnabled ? 1500 : 600;
    const timer = setTimeout(() => setShowGameOverModal(true), delay);
    return () => clearTimeout(timer);
  }, [gameState.gameStatus, gameState.winner, gameSettings.animationsEnabled]);

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
  }, [gameState.board, gameState.currentPlayer, gameState.gameStatus, multiJumpInProgress]);

    // Auto-save after each move.
    //
    // This used to list `gameState` as a dependency. The clock ticks once a
    // second and replaces that object, so the whole game — board, history,
    // captured pieces — was being serialised and written to localStorage every
    // second for the entire session rather than once per move. The effect now
    // watches the fields that actually represent progress, and reads the full
    // state through a ref so the saved snapshot is still current.
    useEffect(() => {
      if (gameStateRef.current.gameStatus === 'playing' && gameSettings.autoSave) {
        saveGameState(
          gameStateRef.current,
          turnNumber,
          gameStartTime,
          kingsPromoted,
          multiJumpInProgress,
          currentJumpPiece,
          accumulatedCaptures,
          chainOrigin,
          aiThinking,
          piecesWithCaptures
        ).catch(error => {
          console.warn('Failed to auto-save game:', error);
        });
      }
      // gameState is deliberately absent: see above. The board, turn and status
      // cover every change worth persisting.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      gameState.board,
      gameState.currentPlayer,
      gameState.gameStatus,
      gameState.moveHistory.length,
      turnNumber,
      gameStartTime,
      kingsPromoted,
      multiJumpInProgress,
      currentJumpPiece,
      accumulatedCaptures,
      chainOrigin,
      piecesWithCaptures,
      gameSettings.autoSave,
    ]);

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
        gameSettings.gameSpeed
      );

    // Show thinking state. No toast here on purpose — the board already renders
    // an "AI is thinking..." banner, and a toast saying the same thing was just
    // extra noise stacking up over the game.
    setAiThinking(true);
    setAiThinkingMessage(getAIThinkingMessage(actualGameMode));

    // Cancelled if the effect re-runs (new turn, unmount) before we finish, so a
    // stale worker reply can never be applied to a board that has moved on.
    let cancelled = false;
    const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

    (async () => {
      try {
        // ----- continuing a chain the search already chose -----
        if (isAIMultiJump && currentJumpPiece) {
          await pause(adjustedThinkingTime);
          if (cancelled) return;

          const nextHop = aiPlannedPath[0];
          const { captures } = getValidMovesForPiece(currentJumpPiece);

          // Follow the planned hop. Previously this took captures[0] with no
          // evaluation at all, so the AI could pick a 1-piece branch when a
          // 3-piece one was available.
          const planned = nextHop
            ? resolveCapturePath(captures, currentJumpPiece, nextHop)
            : null;

          if (planned) {
            setAiPlannedPath(prev => prev.slice(1));
            executeCapture(currentJumpPiece, planned.node.position, planned);
            playSound(() => soundManager.playAIMoveSound());
          } else {
            console.error('AI multi-jump lost its planned path');
            setMultiJumpInProgress(false);
            setCurrentJumpPiece(null);
            setAiPlannedPath([]);
          }
          setAiThinking(false);
          return;
        }

        // ----- a fresh turn -----
        // The search runs on a worker thread while the thinking delay elapses,
        // so the wait the player already sees absorbs the computation instead of
        // the two adding up.
        const [aiMove] = await Promise.all([
          requestAIMove(gameState.board, aiColor, difficulty),
          pause(adjustedThinkingTime),
        ]);
        if (cancelled) return;

        if (!aiMove) {
          console.error('AI could not calculate a move');
          setAiThinking(false);
          return;
        }

        const piece = gameState.board[aiMove.move.from.row][aiMove.move.from.col];
        if (!piece) {
          console.error('AI piece not found on board at position:', aiMove.move.from);
          setAiThinking(false);
          return;
        }

        const [firstHop, ...restOfPath] = aiMove.move.path;
        setAiPlannedPath(restOfPath);

        if (aiMove.move.isCapture) {
          const { captures } = getValidMovesForPiece(piece);
          const resolved = resolveCapturePath(captures, piece, firstHop);
          if (resolved) {
            executeCapture(piece, resolved.node.position, resolved);
          } else {
            console.error('AI planned a capture the board does not offer', firstHop);
            setAiThinking(false);
            return;
          }
        } else {
          executeNormalMove(piece, firstHop);
        }

        const comment = getAIMoveComment(
          aiMove.move.captured.length,
          aiMove.move.promotes,
          actualGameMode
        );
        setTimeout(() => {
          if (!cancelled) {
            addToast({
              type: 'success',
              message: 'AI Move',
              description: comment,
              duration: 3000,
            });
          }
        }, 300);

        playSound(() => soundManager.playAIMoveSound());
        setAiThinking(false);
      } catch (error) {
        console.error('AI Error:', error);
        setAiThinking(false);
      }
    })();

    return () => { cancelled = true; };
  // aiPlannedPath has to be here: during a chain, multiJumpInProgress stays
  // true from the second hop onwards, so without a dependency that actually
  // changes each hop this effect never re-fires and the AI freezes mid-chain
  // (2-hop chains finished by luck; 3+ hung).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.currentPlayer, gameState.gameStatus, multiJumpInProgress, aiPlannedPath]);

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
    setChainOrigin(null);
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
    const winner: PlayerColor = opponentOf(gameState.currentPlayer);
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
      
      {/* Game Over Modal — held back by showGameOverModal so the winning move
          is on screen for a moment before this covers the board. */}
      {showGameOverModal && gameState.winner && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-over-title"
          className={`fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto ${
            gameSettings.animationsEnabled ? 'animate-game-over-backdrop' : ''
          }`}
        >
          <div
            className={`bg-background-light dark:bg-background-dark rounded-2xl shadow-2xl max-w-lg w-full mx-4 my-8 max-h-[85vh] overflow-y-auto border border-primary/30 ${
              gameSettings.animationsEnabled ? 'animate-game-over-card' : ''
            }`}
          >
            {/* Header with Trophy */}
            <div className="relative bg-gradient-to-br from-yellow-500/20 via-yellow-600/20 to-orange-500/20 p-6 text-center border-b border-primary/20">
              <div className="flex justify-center mb-3">
                <div
                  className={`p-3 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-lg ${
                    gameSettings.animationsEnabled ? 'animate-game-over-trophy' : ''
                  }`}
                >
                  {/* Was the same 5-pointed star path used for the "king crown" */}
                  <Trophy className="w-10 h-10 text-white" aria-hidden="true" />
                </div>
              </div>
              <h2 id="game-over-title" className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
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
