import { useState, useEffect } from 'react';
import { GameState, Piece, Position, PlayerColor, Move, Board as BoardType, GameMode, PossibleMove } from '../types';
import Board from './Board';
import GameInfo from './GameInfo';
import Controls from './Controls';
import MoveHistory from './MoveHistory';
import { useToast } from './ToastNotification';
import { calculateAIMove, AI_DIFFICULTIES, getAIThinkingMessage, getAIMoveComment, type AIMove } from '../utils/aiEngine';

interface GameProps {
  onBackToMenu: () => void;
  gameMode: GameMode;
}

const Game = ({ onBackToMenu, gameMode }: GameProps) => {
  // Determine if current player is AI (moved to top for early initialization)
  const isAIGame = gameMode !== 'pvp';
  const aiColor: PlayerColor = 'red'; // AI always plays red

  const [gameState, setGameState] = useState<GameState>(() => initializeGame());
  const [turnNumber, setTurnNumber] = useState(1);
  const [gameStartTime] = useState(Date.now());
  const [kingsPromoted, setKingsPromoted] = useState({ red: 0, black: 0 });
  const [multiJumpInProgress, setMultiJumpInProgress] = useState(false);
  const [currentJumpPiece, setCurrentJumpPiece] = useState<Piece | null>(null);
  const [accumulatedCaptures, setAccumulatedCaptures] = useState<Piece[]>([]);
  const [aiThinking, setAiThinking] = useState(false);
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
      gameMode: 'pvp',
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
    
    while (true) {
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
    while (true) {
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
      
      while (true) {
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
        message: '🤖 AI is thinking...',
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
      addToast({
        type: 'warning',
        message: 'Wrong Turn!',
        description: `It's ${gameState.currentPlayer} player's turn.`,
        duration: 3000,
      });
      return;
    }
    
    const { moves, captures, mustCapture } = getValidMovesForPiece(piece);
    
    if (captures.length === 0 && moves.length === 0) {
      addToast({
        type: 'info',
        message: 'No Valid Moves',
        description: 'This piece cannot move. Select another piece.',
        duration: 3000,
      });
      return;
    }
    
    if (mustCapture && captures.length === 0) {
      addToast({
        type: 'warning',
        message: 'Must Capture!',
        description: 'Another piece has a mandatory capture available.',
        duration: 3000,
      });
      return;
    }
    
    const validPositions = captures.length > 0 ? flattenCaptureMoves(captures) : moves;
    
    if (mustCapture && captures.length > 0) {
      addToast({
        type: 'info',
        message: '⚔️ Capture Available!',
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
    
    // Move the piece
    let movedPiece: Piece = {
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
          message: '👑 King Promoted!',
          description: 'Your piece reached the opposite end and became a King!',
          duration: 4000,
        });
      }
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
        message: `🔄 Continue Capturing! (${currentCaptures.length} captured)`,
        description: 'You have more captures available. Keep going!',
        duration: 3000,
      });
      
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
      message: `⚔️ Captured ${currentCaptures.length} Piece${currentCaptures.length > 1 ? 's' : ''}!`,
      description: currentCaptures.length > 1 ? 'Multi-jump complete!' : 'Great move!',
      duration: 3000,
    });
    
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
          message: '👑 King Promoted!',
          description: 'Your piece reached the opposite end and became a King!',
          duration: 4000,
        });
      }
    }
    
    newBoard[oldRow][oldCol] = null;
    newBoard[newRow][newCol] = movedPiece;
    
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
    
    // Show turn change notification
    if (!winner && capturedPieces.length === 0) {
      setTimeout(() => {
        const playerName = nextPlayer === 'red' 
          ? (isAIGame ? '🤖 AI' : 'Red Player') 
          : 'Black Player';
        addToast({
          type: 'info',
          message: `${playerName}'s Turn`,
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
        ? (isAIGame ? '🤖 AI' : 'Red player') 
        : 'Black player';
      addToast({
        type: 'success',
        message: '🎉 Game Over!',
        description: `${winnerName} wins!`,
        duration: 5000,
      });
      return lastPlayer;
    }
    
    return undefined;
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

    const difficulty = AI_DIFFICULTIES[gameMode];
    if (!difficulty) {
      console.error('AI difficulty not found for gameMode:', gameMode);
      return;
    }

    console.log('🤖 AI Move Logic Triggered', {
      isAITurn,
      isAIMultiJump,
      currentPlayer: gameState.currentPlayer,
      aiColor,
      multiJumpInProgress,
      currentJumpPiece: currentJumpPiece?.id
    });

    // Show thinking message
    setAiThinking(true);
    const thinkingMsg = getAIThinkingMessage(gameMode);
    addToast({
      type: 'info',
      message: '🤖 AI Thinking...',
      description: thinkingMsg,
      duration: difficulty.thinkingTime,
    });

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
          const comment = getAIMoveComment(captureCount, becameKing, gameMode);
          
          setTimeout(() => {
            addToast({
              type: 'success',
              message: '🤖 AI Move',
              description: comment,
              duration: 3000,
            });
          }, 300);
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
    }, difficulty.thinkingTime);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.currentPlayer, gameState.gameStatus, multiJumpInProgress]);

  // Handle new game
  function handleNewGame() {
    setGameState(initializeGame());
    setTurnNumber(1);
    setKingsPromoted({ red: 0, black: 0 });
    setMultiJumpInProgress(false);
    setCurrentJumpPiece(null);
    setAccumulatedCaptures([]);
    setAiThinking(false);
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
          
          {/* Multi-jump indicator */}
          {multiJumpInProgress && (
            <div className="mt-4 p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg backdrop-blur-sm">
              <p className="text-yellow-300 font-semibold text-center">
                🔄 Multi-Jump in Progress - Continue capturing!
              </p>
            </div>
          )}

          {/* AI Thinking indicator */}
          {aiThinking && (
            <div className="mt-4 p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg backdrop-blur-sm animate-pulse">
              <p className="text-blue-300 font-semibold text-center">
                🤖 AI is thinking...
              </p>
            </div>
          )}
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
      
      {/* Game Over Modal */}
      {gameState.gameStatus === 'finished' && gameState.winner && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-background-light dark:bg-background-dark rounded-2xl shadow-2xl max-w-lg w-full mx-4 my-8 max-h-[85vh] overflow-y-auto border border-primary/30">
            {/* Header with Trophy */}
            <div className="relative bg-gradient-to-br from-yellow-500/20 via-yellow-600/20 to-orange-500/20 p-6 text-center border-b border-primary/20">
              <div className="flex justify-center mb-3">
                <div className="p-3 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-lg">
                  <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L15 9L22 9L17 14L19 21L12 17L5 21L7 14L2 9L9 9L12 2Z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {gameState.winner === 'red' 
                  ? (isAIGame ? '🤖 AI' : 'Red') 
                  : 'Black'} Wins!
              </h2>
              <p className="text-base text-gray-600 dark:text-gray-400 mb-1">
                {getVictoryMessage(gameState.winner)}
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
                    <p className="text-xl font-bold text-yellow-500">👑</p>
                    <p className="text-base font-bold text-gray-900 dark:text-white">{kingsPromoted.red}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Red</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-yellow-500">👑</p>
                    <p className="text-base font-bold text-gray-900 dark:text-white">{kingsPromoted.black}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Black</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={handleRematch}
                  className="w-full py-2.5 px-6 font-bold text-white bg-primary hover:bg-primary/90 rounded-lg transition-all duration-300 transform hover:scale-[1.02] shadow-lg"
                >
                  🔄 Rematch
                </button>
                <button
                  onClick={handleNewGame}
                  className="w-full py-2.5 px-6 font-bold text-gray-800 dark:text-white bg-primary/20 dark:bg-primary/30 hover:bg-primary/30 dark:hover:bg-primary/40 rounded-lg transition-all duration-300"
                >
                  ✨ New Game
                </button>
                <button
                  onClick={onBackToMenu}
                  className="w-full py-2.5 px-6 font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30 rounded-lg transition-all duration-300"
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
