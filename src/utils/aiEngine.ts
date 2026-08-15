import { Piece, Position, PlayerColor, Board as BoardType, PossibleMove } from '../types';
import {
  getAllValidMovesForPlayer,
  getPossibleCaptures,
  findPieceById,
  simulateMove,
  positionsEqual,
  opponentOf,
} from './rules';

// AI difficulty settings
export interface AIDifficulty {
  depth: number;
  thinkingTime: number; // milliseconds
  randomness: number; // 0-1, higher = more random mistakes
}

export const AI_DIFFICULTIES: Record<string, AIDifficulty> = {
  'ai-easy': {
    depth: 1,
    thinkingTime: 500,
    randomness: 0.3,
  },
  'ai-medium': {
    depth: 3,
    thinkingTime: 1000,
    randomness: 0.15,
  },
  'ai-hard': {
    depth: 2,
    thinkingTime: 600,
    randomness: 0.1,
  },
};

// AI Move result
export interface AIMove {
  piece: Piece;
  targetPosition: Position;
  captureMove?: PossibleMove;
  score: number;
  depth: number;
}

// Board evaluation weights
const WEIGHTS = {
  PIECE: 100,
  KING: 180,              // Increased king value
  BACK_ROW: 20,           // Increased back row protection
  MIDDLE_CONTROL: 15,     // Increased center control importance
  ADVANCED_POSITION: 8,   // Increased advancement bonus
  EDGE_PENALTY: -15,      // Increased edge penalty
  SAFE_PIECE: 10,         // Increased safety importance
  MOBILITY: 5,            // Increased mobility importance
  CAPTURE_THREAT: 15,     // New: Bonus for threatening captures
};

// ============================================
// BOARD EVALUATION
// ============================================

function evaluateBoard(board: BoardType, aiColor: PlayerColor): number {
  let score = 0;
  const opponentColor: PlayerColor = opponentOf(aiColor);
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      
      const multiplier = piece.color === aiColor ? 1 : -1;
      
      // Basic piece value
      let pieceScore = piece.type === 'king' ? WEIGHTS.KING : WEIGHTS.PIECE;
      
      // Position bonuses
      if (piece.type === 'normal') {
        // Back row protection (valuable for defense)
        const backRow = piece.color === 'red' ? 0 : 7;
        if (piece.position.row === backRow) {
          pieceScore += WEIGHTS.BACK_ROW;
        }
        
        // Advanced position (closer to becoming king)
        const advancement = piece.color === 'red' 
          ? piece.position.row 
          : (7 - piece.position.row);
        pieceScore += advancement * WEIGHTS.ADVANCED_POSITION;
      }
      
      // Middle control (center 4x4 squares are strategic)
      if (row >= 2 && row <= 5 && col >= 2 && col <= 5) {
        pieceScore += WEIGHTS.MIDDLE_CONTROL;
      }
      
      // Edge penalty (vulnerable positions)
      if (col === 0 || col === 7) {
        pieceScore += WEIGHTS.EDGE_PENALTY;
      }
      
      // Safety: check if piece is protected or can be captured
      const isSafe = isPieceSafe(piece, board);
      if (isSafe) {
        pieceScore += WEIGHTS.SAFE_PIECE;
      }
      
      score += pieceScore * multiplier;
    }
  }
  
  // Mobility bonus (number of available moves)
  const aiMoves = getAllValidMovesForPlayer(board, aiColor);
  const opponentMoves = getAllValidMovesForPlayer(board, opponentColor);
  
  const aiMobility = aiMoves.captures.size + aiMoves.normalMoves.size;
  const opponentMobility = opponentMoves.captures.size + opponentMoves.normalMoves.size;
  
  score += (aiMobility - opponentMobility) * WEIGHTS.MOBILITY;
  
  // Capture threat bonus (having capture opportunities is valuable)
  const aiCaptureCount = aiMoves.captures.size;
  const opponentCaptureCount = opponentMoves.captures.size;
  
  score += aiCaptureCount * WEIGHTS.CAPTURE_THREAT;
  score -= opponentCaptureCount * WEIGHTS.CAPTURE_THREAT; // Penalty if opponent can capture
  
  return score;
}

function isPieceSafe(piece: Piece, board: BoardType): boolean {
  const opponentColor: PlayerColor = opponentOf(piece.color);
  
  // Check if any opponent piece can capture this piece
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const opponent = board[row][col];
      if (opponent && opponent.color === opponentColor) {
        const captures = getPossibleCaptures(opponent, board);
        for (const capture of captures) {
          if (captureContainsPiece(capture, piece)) {
            return false;
          }
        }
      }
    }
  }
  
  return true;
}

function captureContainsPiece(capture: PossibleMove, targetPiece: Piece): boolean {
  for (const captured of capture.capturedPieces) {
    if (captured.id === targetPiece.id) {
      return true;
    }
  }
  
  if (capture.continuations) {
    for (const cont of capture.continuations) {
      if (captureContainsPiece(cont, targetPiece)) {
        return true;
      }
    }
  }
  
  return false;
}

// ============================================
// MINIMAX WITH ALPHA-BETA PRUNING
// ============================================

function minimax(
  board: BoardType,
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  aiColor: PlayerColor
): number {
  // Terminal conditions
  if (depth === 0) {
    return evaluateBoard(board, aiColor);
  }
  
  const currentPlayer = maximizingPlayer ? aiColor : opponentOf(aiColor);
  const allMoves = getAllValidMovesForPlayer(board, currentPlayer);
  
  // Check for game over (no moves available)
  if (allMoves.captures.size === 0 && allMoves.normalMoves.size === 0) {
    return maximizingPlayer ? -10000 : 10000;
  }
  
  if (maximizingPlayer) {
    let maxEval = -Infinity;
    
    // Try capture moves first (better move ordering)
    for (const [pieceId, captures] of allMoves.captures) {
      const piece = findPieceById(board, pieceId);
      if (!piece) continue;
      
      for (const capture of captures) {
        const allCaptured = collectAllCapturedInMove(capture, capture.position);
        const newBoard = simulateMove(board, piece, capture.position, allCaptured);
        
        const evaluation = minimax(newBoard, depth - 1, alpha, beta, false, aiColor);
        maxEval = Math.max(maxEval, evaluation);
        alpha = Math.max(alpha, evaluation);
        
        if (beta <= alpha) break;
      }
    }
    
    // Try normal moves if no captures
    if (allMoves.captures.size === 0) {
      for (const [pieceId, moves] of allMoves.normalMoves) {
        const piece = findPieceById(board, pieceId);
        if (!piece) continue;
        
        for (const move of moves) {
          const newBoard = simulateMove(board, piece, move, []);
          
          const evaluation = minimax(newBoard, depth - 1, alpha, beta, false, aiColor);
          maxEval = Math.max(maxEval, evaluation);
          alpha = Math.max(alpha, evaluation);
          
          if (beta <= alpha) break;
        }
      }
    }
    
    return maxEval;
  } else {
    let minEval = Infinity;
    
    for (const [pieceId, captures] of allMoves.captures) {
      const piece = findPieceById(board, pieceId);
      if (!piece) continue;
      
      for (const capture of captures) {
        const allCaptured = collectAllCapturedInMove(capture, capture.position);
        const newBoard = simulateMove(board, piece, capture.position, allCaptured);
        
        const evaluation = minimax(newBoard, depth - 1, alpha, beta, true, aiColor);
        minEval = Math.min(minEval, evaluation);
        beta = Math.min(beta, evaluation);
        
        if (beta <= alpha) break;
      }
    }
    
    if (allMoves.captures.size === 0) {
      for (const [pieceId, moves] of allMoves.normalMoves) {
        const piece = findPieceById(board, pieceId);
        if (!piece) continue;
        
        for (const move of moves) {
          const newBoard = simulateMove(board, piece, move, []);
          
          const evaluation = minimax(newBoard, depth - 1, alpha, beta, true, aiColor);
          minEval = Math.min(minEval, evaluation);
          beta = Math.min(beta, evaluation);
          
          if (beta <= alpha) break;
        }
      }
    }
    
    return minEval;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function collectAllCapturedInMove(captureMove: PossibleMove, targetPos: Position): Piece[] {
  const allCaptured: Piece[] = [];
  
  function traverse(move: PossibleMove, target: Position): boolean {
    allCaptured.push(...move.capturedPieces);
    
    if (positionsEqual(move.position, target)) {
      return true;
    }
    
    if (move.continuations) {
      for (const cont of move.continuations) {
        if (traverse(cont, target)) {
          return true;
        }
      }
    }
    
    allCaptured.splice(allCaptured.length - move.capturedPieces.length, move.capturedPieces.length);
    return false;
  }
  
  traverse(captureMove, targetPos);
  return allCaptured;
}

// ============================================
// MAIN AI FUNCTION
// ============================================

export function calculateAIMove(
  board: BoardType,
  aiColor: PlayerColor,
  difficulty: AIDifficulty
): AIMove | null {
  console.log(`[AI] Starting calculation for ${aiColor} at depth ${difficulty.depth}`);
  const startTime = Date.now();
  
  const allMoves = getAllValidMovesForPlayer(board, aiColor);
  
  // No moves available
  if (allMoves.captures.size === 0 && allMoves.normalMoves.size === 0) {
    console.log('[AI] No moves available');
    return null;
  }
  
  let bestMove: AIMove | null = null;
  let bestScore = -Infinity;
  
  // Evaluate all possible moves
  const movesToEvaluate: Array<{ piece: Piece; position: Position; capture?: PossibleMove }> = [];
  
  // Add capture moves
  for (const [pieceId, captures] of allMoves.captures) {
    const piece = findPieceById(board, pieceId);
    if (!piece) continue;
    
    for (const capture of captures) {
      movesToEvaluate.push({ piece, position: capture.position, capture });
    }
  }
  
  // Add normal moves (only if no captures)
  if (allMoves.captures.size === 0) {
    for (const [pieceId, moves] of allMoves.normalMoves) {
      const piece = findPieceById(board, pieceId);
      if (!piece) continue;
      
      for (const move of moves) {
        movesToEvaluate.push({ piece, position: move });
      }
    }
  }
  
  console.log(`[AI] Evaluating ${movesToEvaluate.length} possible moves`);
  
  // Evaluate each move
  let moveCount = 0;
  for (const { piece, position, capture } of movesToEvaluate) {
    moveCount++;
    if (moveCount % 5 === 0) {
      console.log(`[AI] Progress: ${moveCount}/${movesToEvaluate.length} moves evaluated`);
    }
    const capturedPieces = capture ? collectAllCapturedInMove(capture, position) : [];
    const newBoard = simulateMove(board, piece, position, capturedPieces);
    
    // Use minimax to evaluate the move
    const score = minimax(newBoard, difficulty.depth - 1, -Infinity, Infinity, false, aiColor);
    
    // Add randomness for lower difficulties
    const randomFactor = (Math.random() - 0.5) * difficulty.randomness * 100;
    const adjustedScore = score + randomFactor;
    
    if (adjustedScore > bestScore) {
      bestScore = adjustedScore;
      bestMove = {
        piece,
        targetPosition: position,
        captureMove: capture,
        score: adjustedScore,
        depth: difficulty.depth,
      };
    }
  }
  
  const elapsed = Date.now() - startTime;
  console.log(`[AI] Calculation complete in ${elapsed}ms. Best score: ${bestScore}`);
  
  return bestMove;
}

// ============================================
// THINKING MESSAGES
// ============================================

export function getAIThinkingMessage(difficulty: string): string {
  const messages: Record<string, string[]> = {
    'ai-easy': [
      'Hmm, let me think...',
      'Considering my options...',
      'What should I do next?',
      'Thinking of a move...',
    ],
    'ai-medium': [
      'Analyzing the board...',
      'Calculating possibilities...',
      'Evaluating positions...',
      'Planning my strategy...',
    ],
    'ai-hard': [
      'Deep analysis in progress...',
      'Computing optimal move...',
      'Scanning all variations...',
      'Processing complex patterns...',
    ],
  };
  
  const difficultyMessages = messages[difficulty] || messages['ai-medium'];
  return difficultyMessages[Math.floor(Math.random() * difficultyMessages.length)];
}

export function getAIMoveComment(captureCount: number, becameKing: boolean, difficulty: string): string {
  if (becameKing) {
    return difficulty === 'ai-hard' 
      ? '👑 King promotion - strategic advantage secured!'
      : '👑 My piece became a King!';
  }
  
  if (captureCount >= 3) {
    return difficulty === 'ai-hard'
      ? '⚔️ Triple capture! Devastating combination!'
      : '⚔️ Amazing multi-capture!';
  }
  
  if (captureCount === 2) {
    return difficulty === 'ai-hard'
      ? '⚔️ Double capture executed perfectly!'
      : '⚔️ Double capture!';
  }
  
  if (captureCount === 1) {
    const messages = [
      'Got one of your pieces!',
      'Nice capture!',
      'Taking that piece!',
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }
  
  // Normal move
  const messages = [
    'Moving strategically...',
    'Advancing my position...',
    'Building pressure...',
    'Setting up my pieces...',
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

