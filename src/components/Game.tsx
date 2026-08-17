import { useState, useEffect, useMemo, useRef } from 'react';
import { Trophy, Crown, Repeat, Bot, Sparkles, RotateCcw, ArrowLeft } from 'lucide-react';
import { GameState, Piece, Position, PlayerColor, Move, Board as BoardType, GameMode, PossibleMove } from '../types';
import Board from './Board';
import GameInfo from './GameInfo';
import Controls from './Controls';
import MoveHistory from './MoveHistory';
import { ToastOutlet } from './ToastNotification';
import { useToast } from './toastContext';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { AI_DIFFICULTIES, getAIThinkingMessage, getAIMoveComment } from '../utils/aiEngine';
import { requestAIMove } from '../utils/aiClient';
import { saveGameState, loadGameState, clearGameState, clearAllGameData } from '../utils/gamePersistence';
import { capturedLabel } from '../utils/labels';
import { recordGameResult } from '../utils/gameStats';
import { getGameSettings, getAIThinkingTime, updateSoundSettings } from '../utils/gameSettings';
import { soundManager } from '../utils/soundManager';
import {
  createInitialBoard,
  getAllValidMovesForPlayer,
  resolveCapturePath,
  captureDestinations,
  type ResolvedCapturePath,
  positionsEqual,
  promotionRow,
  opponentOf,
  findWinner,
  squareName,
} from '../utils/rules';

interface GameProps {
  onBackToMenu: () => void;
  onBackToMenuAfterQuit?: () => void;
  onGameQuit?: () => void;
  gameMode: GameMode;
}

/**
 * The game as it stood before one completed turn.
 *
 * Undo restores a snapshot rather than replaying the move backwards. Reversing a
 * checkers turn by hand means un-promoting a king, resurrecting every piece a
 * chain took and restoring each one's type — several places to get subtly wrong,
 * all of which a snapshot gets right for free.
 */
interface TurnSnapshot {
  gameState: GameState;
  turnNumber: number;
  kingsPromoted: { red: number; black: number };
}

/** Undo depth. Snapshots are whole boards, so the stack is not unbounded. */
const MAX_UNDO_DEPTH = 30;

/** Snapshot the pieces too: restoring must not hand back a shared object. */
function cloneSnapshotState(state: GameState): GameState {
  return {
    ...state,
    board: state.board.map(row => row.map(square => (square ? { ...square } : null))),
    moveHistory: [...state.moveHistory],
    score: { ...state.score },
    playerTimers: state.playerTimers ? { ...state.playerTimers } : undefined,
    selectedPiece: null,
    validMoves: [],
    possibleCaptures: [],
  };
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
  // Doubles as the game's identity for statistics, so it must change when a new
  // game starts and survive a resume.
  const [gameStartTime, setGameStartTime] = useState(() => {
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
  // One entry per completed turn, holding the position as it stood *before* that
  // turn. Deliberately not persisted: a snapshot is a whole board, and writing a
  // stack of them to localStorage on every move would dwarf the saved game
  // itself. Undo is therefore available for the current session only — the
  // button simply isn't offered after a resume until you move again.
  const [undoStack, setUndoStack] = useState<TurnSnapshot[]>([]);
  const [aiThinking, setAiThinking] = useState(false);
  // Whether a search currently owns the turn. Held in a ref rather than read
  // from `aiThinking` so the guard can never see a stale value — see the AI
  // effect for why that mattered.
  const aiSearchRef = useRef(false);
  // Identifies each search, so an abandoned one cannot release a newer one.
  const aiRunIdRef = useRef(0);
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

  // Keeps keyboard focus inside the game-over dialog while it is open, and
  // restores it afterwards.
  const gameOverRef = useFocusTrap<HTMLDivElement>(showGameOverModal);

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

  /**
   * Clear the current selection (Escape).
   *
   * Deliberately refuses mid-chain: once a multi-jump has started the rest of
   * the sequence is mandatory, so letting Escape abandon it would allow an
   * illegal half-finished turn.
   */
  function handleDeselect() {
    if (multiJumpInProgress) {
      addToast({
        type: 'info',
        message: 'Capture must be completed',
        description: 'You have already started a jump and have to finish it.',
        duration: 2500,
      });
      return;
    }

    if (!gameState.selectedPiece) return;

    setGameState(prev => ({
      ...prev,
      selectedPiece: null,
      validMoves: [],
      possibleCaptures: [],
    }));
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
        
        setGameState(prev => ({
          ...prev,
          selectedPiece: piece,
          validMoves: validPositions,
          possibleCaptures: captures
        }));
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
    
    setGameState(prev => ({
      ...prev,
      selectedPiece: piece,
      validMoves: validPositions,
      possibleCaptures: captures,
      mustCapture
    }));
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

  /**
   * Record the position before a turn begins.
   *
   * Guarded on `multiJumpInProgress` because the hops of a capture chain are one
   * turn: snapshotting each hop would make Undo step backwards through a
   * half-finished jump and leave the board in a state the rules forbid.
   */
  function pushUndoSnapshot() {
    if (multiJumpInProgress) return;

    const snapshot: TurnSnapshot = {
      gameState: cloneSnapshotState(gameStateRef.current),
      turnNumber,
      kingsPromoted,
    };

    setUndoStack(prev => [...prev, snapshot].slice(-MAX_UNDO_DEPTH));
  }

  /**
   * Take back the last move.
   *
   * Against the AI this rewinds two plies, not one. Undoing a single ply would
   * hand the turn straight back to the AI, which would simply move again — the
   * player would watch the board change and never get their decision back.
   * Rewinding to the last position where it was the human's turn is what "undo
   * my move" means.
   */
  function handleUndo() {
    if (!gameSettings.undoEnabled) return;

    if (aiThinking) {
      addToast({
        type: 'info',
        message: 'AI is thinking...',
        description: 'Wait for the move to land before taking it back.',
        duration: 2000,
      });
      return;
    }

    if (multiJumpInProgress) {
      addToast({
        type: 'info',
        message: 'Finish the capture first',
        description: 'A jump that has started has to be completed before it can be undone.',
        duration: 2500,
      });
      return;
    }

    const target = undoTargetIndex();
    if (target < 0) return;

    const snapshot = undoStack[target];
    setUndoStack(undoStack.slice(0, target));

    setGameState({
      ...cloneSnapshotState(snapshot.gameState),
      // The clock should not charge anyone for the time spent deciding to undo.
      turnStartTime: Date.now(),
    });
    setTurnNumber(snapshot.turnNumber);
    setKingsPromoted(snapshot.kingsPromoted);
    setMultiJumpInProgress(false);
    setCurrentJumpPiece(null);
    setAccumulatedCaptures([]);
    setChainOrigin(null);
    setAiPlannedPath([]);
    setClockNow(Date.now());

    addToast({
      type: 'info',
      message: 'Move taken back',
      description: isAIGame ? 'Your move and the AI\'s reply were undone.' : 'The last move was undone.',
      duration: 2500,
    });
  }

  /**
   * Index of the snapshot Undo would restore, or -1 if there is nothing to take
   * back. In an AI game that is the most recent position where the human was to
   * move; in PvP it is simply the previous turn.
   */
  function undoTargetIndex(): number {
    if (gameState.gameStatus !== 'playing') return -1;
    if (!isAIGame) return undoStack.length - 1;

    const humanColor = opponentOf(aiColor);
    for (let i = undoStack.length - 1; i >= 0; i--) {
      if (undoStack[i].gameState.currentPlayer === humanColor) return i;
    }
    return -1;
  }

  const canUndo =
    gameSettings.undoEnabled &&
    !aiThinking &&
    !multiJumpInProgress &&
    undoTargetIndex() >= 0;

  /**
   * Pieces the keyboard's C shortcut can jump to, in board reading order.
   *
   * Only ever the side a person is playing. The AI does not use a keyboard, so
   * offering the shortcut on its turn would just select a piece the player is
   * not allowed to touch. In PvP both sides qualify — whoever is to move is a
   * person.
   */
  const captureCandidates = useMemo<Piece[]>(() => {
    if (gameState.gameStatus !== 'playing' || aiThinking) return [];
    if (isAIGame && gameState.currentPlayer === aiColor) return [];

    // Mid-chain the mandatory-capture set is stale — the effect that fills it
    // skips while a chain runs — and in any case the only legal piece is the one
    // still jumping.
    if (multiJumpInProgress) return currentJumpPiece ? [currentJumpPiece] : [];

    const found: Piece[] = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = gameState.board[row][col];
        if (piece && piecesWithCaptures.has(piece.id)) found.push(piece);
      }
    }
    return found;
  }, [
    gameState.board,
    gameState.currentPlayer,
    gameState.gameStatus,
    piecesWithCaptures,
    multiJumpInProgress,
    currentJumpPiece,
    aiThinking,
    isAIGame,
    aiColor,
  ]);

  /**
   * Spoken description of the last completed turn.
   *
   * Without this a screen reader knows a move happened — the thinking banner
   * goes away, a toast fires — but not what it was, so finding the change meant
   * arrowing across the board every turn.
   *
   * Built from the move history rather than from the board, so a multi-jump is
   * announced once, as a whole turn, instead of once per hop: history is only
   * appended when the chain finishes.
   *
   * The leading move number is not decoration. `aria-live` announces on content
   * *change*, so a move whose description matches the previous one would be
   * silently swallowed; the number guarantees every turn differs, and doubles as
   * a position in the game.
   */
  const moveAnnouncement = useMemo(() => {
    const last = gameState.moveHistory[gameState.moveHistory.length - 1];
    if (!last) return '';

    // finalizeTurn has already handed the turn over, so the mover is the side
    // that is *not* to move.
    const mover = opponentOf(gameState.currentPlayer);
    const moverName = isAIGame
      ? mover === aiColor ? 'AI' : 'You'
      : mover === 'red' ? 'Red' : 'Black';

    const parts = [
      `Move ${gameState.moveHistory.length}. ${moverName} moved ` +
      `${squareName(last.from.row, last.from.col)} to ${squareName(last.to.row, last.to.col)}`,
    ];

    const captured = last.capturedPieces?.length ?? 0;
    if (captured > 0) {
      parts.push(`capturing ${captured} ${captured === 1 ? 'piece' : 'pieces'}`);
    }
    if (last.becameKing) parts.push('and was crowned king');

    return parts.join(', ') + '.';
  }, [gameState.moveHistory, gameState.currentPlayer, isAIGame, aiColor]);

  /** C pressed with nothing to jump to. */
  function handleNoCaptures() {
    // On the AI's turn the board already says "AI is thinking"; a second message
    // saying there are no captures would be both redundant and untrue.
    if (aiThinking || (isAIGame && gameState.currentPlayer === aiColor)) return;

    addToast({
      type: 'info',
      message: 'No captures available',
      description: 'Nothing has to be taken this turn. Use the arrow keys to pick a piece.',
      duration: 2500,
    });
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
    // No-op for the second and later hops of a chain — one snapshot per turn.
    pushUndoSnapshot();

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

      setGameState(prev => ({
        ...prev,
        board: newBoard,
        selectedPiece: movedPiece,
        validMoves: captureDestinations(continuations, movedPiece),
        possibleCaptures: continuations,
        score: prev.score // Don't update score during multi-jump
      }));
      
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
    pushUndoSnapshot();

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
    
    // Switch player, then ask whether THEY can continue. Asking about the side
    // that just moved is the wrong question — a player loses when they cannot
    // move on their own turn.
    const nextPlayer: PlayerColor = opponentOf(gameState.currentPlayer);
    const winner = findWinner(newBoard, nextPlayer);
    
    // No turn-change toast: the "Current Player" card in the sidebar already
    // shows whose turn it is, and firing a toast for every single move was the
    // main source of notification spam over the board.

    // Clear saved game state if game is finished
    if (winner) {
      clearGameState();
    }
    
    // Bank the time this turn actually took, then restart the clock for the
    // player now to move.
    const turnEndedAt = Date.now();
    const spent = elapsedThisTurn(turnEndedAt);

    setGameState(prev => {
      const mover = prev.currentPlayer;
      const banked = prev.playerTimers
        ? {
            ...prev.playerTimers,
            [mover]: Math.max(0, prev.playerTimers[mover] - spent),
          }
        : prev.playerTimers;

      return {
        ...prev,
        board: newBoard,
        currentPlayer: nextPlayer,
        selectedPiece: null,
        validMoves: [],
        possibleCaptures: [],
        // Appended to the latest history, not the one captured at render time,
        // so a move can never overwrite one recorded in between.
        moveHistory: [...prev.moveHistory, move],
        score: newScore,
        playerTimers: banked,
        turnStartTime: turnEndedAt,
        gameStatus: winner ? 'finished' : 'playing',
        winner,
        mustCapture: false
      };
    });

    setClockNow(turnEndedAt);
    setTurnNumber(prev => prev + 1);
  }

  /**
   * Safety net: end the game whenever the side to move cannot continue.
   *
   * Win detection used to live inside finalizeTurn, which only runs when a move
   * completes. That misses every other way of arriving at a stuck position — a
   * saved game resumed with the player to move already blocked, or the AI
   * finding no legal move, which previously just logged an error and left the
   * game hanging with no winner and no way to continue.
   *
   * It also raised the game-over toast from inside the state-update path. The
   * dialog announces the result now, so nothing here has side effects beyond
   * ending the game.
   */
  useEffect(() => {
    if (gameState.gameStatus !== 'playing') return;
    // Mid-chain the mover still "has" the turn; the position is not settled yet.
    if (multiJumpInProgress) return;

    const winner = findWinner(gameState.board, gameState.currentPlayer);
    if (!winner) return;

    setGameState(prev => ({ ...prev, gameStatus: 'finished', winner }));
    clearGameState();
  }, [gameState.board, gameState.currentPlayer, gameState.gameStatus, multiJumpInProgress]);

  /**
   * Fold a finished game into the lifetime statistics.
   *
   * Placed here rather than in the individual ending paths because there are
   * four of them — a move that ends the game, the stuck-position safety net,
   * resigning, and the clock running out — and every one of them has to count.
   * `gameStartTime` identifies the game, and `recordGameResult` ignores a repeat,
   * so a re-run of this effect (StrictMode double-invokes it in development)
   * cannot inflate the totals.
   */
  useEffect(() => {
    if (gameState.gameStatus !== 'finished' || !gameState.winner) return;

    recordGameResult({
      gameId: gameStartTime,
      mode: actualGameMode,
      winner: gameState.winner,
      humanColor: isAIGame ? opponentOf(aiColor) : null,
    });
  }, [gameState.gameStatus, gameState.winner, gameStartTime, actualGameMode, isAIGame, aiColor]);

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
      const current = gameStateRef.current;

      if (current.gameStatus === 'playing' && gameSettings.autoSave) {
        saveGameState(
          current,
          turnNumber,
          gameStartTime,
          kingsPromoted,
          multiJumpInProgress,
          currentJumpPiece,
          accumulatedCaptures,
          chainOrigin,
          aiThinking,
          piecesWithCaptures
        );
      } else if (current.gameStatus === 'finished') {
        // This effect owns persistence, so it also owns removing a finished
        // game. The end-of-game paths clear it too, but effect order is not
        // guaranteed: if this one ran afterwards holding a still-"playing"
        // snapshot it would write the game straight back, and the menu would
        // offer to resume something already over.
        clearGameState();
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

  // ============================================
  // CLOCKS
  // ============================================
  //
  // These used to count interval ticks, with the interval torn down and rebuilt
  // whenever the turn changed. A turn shorter than the 1000ms interval therefore
  // cost its player nothing at all — the AI moves in about 950ms and finished
  // games having never lost a single second.
  //
  // Time is now measured from a timestamp taken when the turn began, so it is
  // correct regardless of how the interval happens to line up. The interval below
  // only exists to re-render the display.

  const timerEnabled = gameSettings.timerEnabled;

  const [clockNow, setClockNow] = useState(() => Date.now());
  // Hidden tab means the player is not looking at the board, so the clock stops.
  const [clockPaused, setClockPaused] = useState(() => document.hidden);

  useEffect(() => {
    if (!timerEnabled || gameState.gameStatus !== 'playing') return;
    const interval = setInterval(() => setClockNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [timerEnabled, gameState.gameStatus]);

  // A resumed game should not be charged for the time the tab was closed.
  useEffect(() => {
    setGameState(prev => ({ ...prev, turnStartTime: Date.now() }));
    setClockNow(Date.now());
  }, []);

  /**
   * Stop the clock while the tab is hidden.
   *
   * Otherwise switching tabs mid-turn quietly drains your time and you come back
   * to a game you lost without playing a move. On hide, whatever the turn has
   * cost so far is banked and the clock freezes; on show, measurement restarts
   * from that moment, so the hidden stretch is never charged.
   */
  useEffect(() => {
    if (!timerEnabled) return;

    const handleVisibilityChange = () => {
      const now = Date.now();

      if (document.hidden) {
        setGameState(prev => {
          if (!prev.playerTimers || prev.gameStatus !== 'playing') return prev;
          const spent = Math.max(0, (now - (prev.turnStartTime ?? now)) / 1000);
          return {
            ...prev,
            playerTimers: {
              ...prev.playerTimers,
              [prev.currentPlayer]: Math.max(0, prev.playerTimers[prev.currentPlayer] - spent),
            },
            turnStartTime: now,
          };
        });
        setClockPaused(true);
      } else {
        setGameState(prev => ({ ...prev, turnStartTime: now }));
        setClockNow(now);
        setClockPaused(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [timerEnabled]);

  /**
   * Seconds the current turn has been running, kept fractional.
   *
   * Rounding down to whole seconds here is what let the AI play for free: its
   * turns take about 950ms, and Math.floor(0.95) is 0, so every AI move cost it
   * nothing. Clocks are stored as fractional seconds and only rounded for
   * display.
   */
  function elapsedThisTurn(atMs: number): number {
    const startedAt = gameState.turnStartTime ?? atMs;
    return Math.max(0, (atMs - startedAt) / 1000);
  }

  /** Exact time left for a player, counting the turn in progress. */
  function remainingExact(color: PlayerColor): number {
    const banked = gameState.playerTimers?.[color] ?? 0;
    // Paused, not this player's turn, or the game is over: nothing is accruing.
    if (clockPaused || color !== gameState.currentPlayer || gameState.gameStatus !== 'playing') {
      return banked;
    }
    return banked - elapsedThisTurn(clockNow);
  }

  /** Whole seconds to show on the clock face. */
  function remainingSeconds(color: PlayerColor): number {
    return Math.max(0, Math.ceil(remainingExact(color)));
  }

  // Running out of time now actually loses the game.
  useEffect(() => {
    if (!timerEnabled || clockPaused) return;
    if (gameState.gameStatus !== 'playing' || !gameState.playerTimers) return;
    if (remainingExact(gameState.currentPlayer) > 0) return;

    setGameState(prev => ({
      ...prev,
      playerTimers: { ...prev.playerTimers!, [prev.currentPlayer]: 0 },
      gameStatus: 'finished',
      winner: opponentOf(prev.currentPlayer),
    }));

    // Without this the finished game stays in localStorage as "playing" and the
    // menu offers to resume it. finalizeTurn already does this for a normal
    // win; the timeout and resign paths bypassed it.
    clearGameState();

    addToast({
      type: 'warning',
      message: 'Out of time',
      description: `${gameState.currentPlayer === aiColor && isAIGame ? 'The AI' : 'That player'} ran out of time.`,
      duration: 5000,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockNow, clockPaused, timerEnabled, gameState.gameStatus, gameState.currentPlayer]);

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

    // Re-entrancy guard. This reads a ref, not the `aiThinking` state, because
    // state here is the value from the render that created this effect, and
    // `aiThinking` is deliberately not a dependency. A stale `true` would make
    // this return forever with nothing able to re-trigger it — which is exactly
    // how the board used to lock up. A ref is always current.
    if (aiSearchRef.current) {
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
    const runId = ++aiRunIdRef.current;
    aiSearchRef.current = true;
    setAiThinking(true);
    setAiThinkingMessage(getAIThinkingMessage(actualGameMode));

    /**
     * Release the turn, unless a newer search has already claimed it.
     *
     * The run id matters: an abandoned search finishes its await *after* the
     * replacement has started, and without this check it would clear the newer
     * search's flag and let a second search run concurrently.
     */
    const finish = () => {
      if (aiRunIdRef.current !== runId) return;
      aiSearchRef.current = false;
      setAiThinking(false);
    };

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
          return;
        }

        const piece = gameState.board[aiMove.move.from.row][aiMove.move.from.col];
        if (!piece) {
          console.error('AI piece not found on board at position:', aiMove.move.from);
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
      } catch (error) {
        console.error('AI Error:', error);
      } finally {
        // Every exit path releases the turn, including the `cancelled` returns.
        // Those used to return without clearing it, which stranded the flag and
        // hard-locked the board: it stayed the player's turn, but every click
        // was refused with "AI is thinking".
        finish();
      }
    })();

    return () => {
      cancelled = true;
      // An abandoned search must not hold the turn either. If the replacement
      // run returns early — the usual case, since the turn has passed back to
      // the player — nothing else would ever release it.
      finish();
    };
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
    setClockNow(Date.now());
    // A rematch is a new game, so its duration and its statistics entry both
    // have to start from here. This used to stay fixed for the life of the
    // component, which made the game-over modal report a rematch as having
    // taken from the start of the *first* game.
    setGameStartTime(Date.now());
    setUndoStack([]);
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

  /**
   * The line under the result.
   *
   * This used to be the fixed string "Congratulations, you have successfully
   * conquered the board", shown whoever won — so losing 12-4 to the AI
   * congratulated you on conquering the board.
   */
  function getOutcomeMessage(): string {
    if (!isAIGame) {
      // Both sides are played on this device, so there is no "you" to address.
      return `${gameState.winner === 'red' ? 'Red' : 'Black'} takes the board.`;
    }
    return gameState.winner === aiColor
      ? 'The AI takes this one. Another go?'
      : 'Congratulations, you have successfully conquered the board.';
  }

  /**
   * Rate a player's game from what they achieved.
   *
   * `subject` matters: this was previously called with the *winner*, but
   * displayed unlabelled as though it described the person reading it. Losing
   * badly to the AI produced "Great Performance!" — praise for the AI's twelve
   * captures, shown to the player who had just been beaten. In an AI game it now
   * rates the human; in PvP it rates the winner, whose name is displayed with it.
   */
  function getPerformanceRating(subject: PlayerColor): string {
    const moveCount = gameState.moveHistory.length;
    const captures = gameState.score[subject];

    if (captures >= 10 && moveCount < 30) return 'Excellent Play! 🌟';
    if (captures >= 8) return 'Great Performance! 🎯';
    if (captures >= 5) return 'Good Effort! 👍';
    return 'Nice Try! 💪';
  }

  // Handle resign
  function handleResign() {
    // The winner is derived inside the updater, so resigning always credits the
    // side whose turn it actually is at the moment the click is processed.
    setGameState(prev => ({
      ...prev,
      gameStatus: 'finished',
      winner: opponentOf(prev.currentPlayer)
    }));

    // A resigned game should not be resumable from the menu either.
    clearGameState();
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
      {/* Announces each completed turn. Lives outside the board so that
          re-rendering the grid cannot disturb it, and `polite` so it waits for a
          pause rather than cutting across whatever is being read. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {moveAnnouncement}
      </div>

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
              onDeselect={handleDeselect}
              captureCandidates={captureCandidates}
              onNoCaptures={handleNoCaptures}
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
            timer={{ red: remainingSeconds('red'), black: remainingSeconds('black') }}
            showTimer={timerEnabled}
            gameMode={actualGameMode}
          />
          
          <MoveHistory moves={gameState.moveHistory} maxDisplay={5} />
          
          <Controls 
            onNewGame={handleNewGame} 
            onResign={handleResign} 
            onQuit={handleQuit}
            onUndo={handleUndo}
            canUndo={canUndo}
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
          ref={gameOverRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-over-title"
          className={`fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto outline-none ${
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
                {getOutcomeMessage()}
              </p>
            </div>

            {/* Game Statistics */}
            <div className="p-4 space-y-3">
              {/* Performance Rating */}
              <div className="text-center p-2 bg-primary/5 dark:bg-primary/10 rounded-lg border border-primary/20">
                {/* In PvP the rating needs a name against it, or it reads as a
                    verdict on whoever happens to be looking at the screen. */}
                {!isAIGame && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {gameState.winner === 'red' ? 'Red' : 'Black'} Player
                  </p>
                )}
                <p className="text-base font-bold text-gray-900 dark:text-white">
                  {getPerformanceRating(isAIGame ? opponentOf(aiColor) : gameState.winner!)}
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

              {/* Pieces Captured — "captured by", matching the in-game card.
                  The number beside the red disc is what red took, not what red
                  lost, and the bare label "Red" read as the latter. */}
              <div className="bg-primary/5 dark:bg-primary/10 p-3 rounded-lg border border-primary/20">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Pieces captured by</p>
                <div className="flex justify-around">
                  <div className="flex items-center gap-2">
                    <span className="sr-only">
                      {capturedLabel(isAIGame ? 'AI' : 'Red player', gameState.score.red)}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-red-600 border-2 border-red-800" aria-hidden="true" />
                    <div aria-hidden="true">
                      <p className="text-xs text-gray-500 dark:text-gray-400">{isAIGame ? 'AI' : 'Red'}</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{gameState.score.red}</p>
                    </div>
                  </div>
                  <div className="w-px bg-primary/20"></div>
                  <div className="flex items-center gap-2">
                    <span className="sr-only">
                      {capturedLabel('Black player', gameState.score.black)}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-gray-500" aria-hidden="true" />
                    <div aria-hidden="true">
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
