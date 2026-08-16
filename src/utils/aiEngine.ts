import { Piece, Position, PlayerColor, Board as BoardType, PossibleMove } from '../types';
import {
  getAllValidMovesForPlayer,
  enumerateMoves,
  applyMove,
  findPieceById,
  opponentOf,
  type FullMove,
} from './rules';

// AI difficulty settings
export interface AIDifficulty {
  /** Plies of search. Only meaningful now that deeper actually means stronger. */
  depth: number;
  /** Cosmetic delay before the move appears, in milliseconds. */
  thinkingTime: number;
  /** Jitter added to root scores, in fractions of a piece. Blurs close calls. */
  randomness: number;
  /**
   * Chance of ignoring the search entirely and playing a random legal move.
   * This is how the easier tiers are made to miss things on purpose, rather
   * than hoping a weak search happens to be weak in interesting ways.
   */
  blunderRate: number;
}

/**
 * Depths chosen from measured play, not guesswork. Against a fixed reference
 * engine each rung scores strictly better than the one below it, and depth 6
 * costs ~12ms mean / ~57ms worst case per move on a desktop CPU.
 *
 * Previously this table read easy:1, medium:3, hard:2 — Hard searched
 * SHALLOWER than Medium, while the README documented 2/3/4.
 */
export const AI_DIFFICULTIES: Record<string, AIDifficulty> = {
  'ai-easy': {
    depth: 2,
    thinkingTime: 450,
    randomness: 0.4,
    blunderRate: 0.35,
  },
  'ai-medium': {
    depth: 4,
    thinkingTime: 750,
    randomness: 0.12,
    blunderRate: 0.08,
  },
  'ai-hard': {
    depth: 6,
    thinkingTime: 900,
    randomness: 0,
    blunderRate: 0,
  },
};

// AI Move result
export interface AIMove {
  piece: Piece;
  targetPosition: Position;
  /** The complete chosen turn, including every hop and every capture. */
  move: FullMove;
  score: number;
  depth: number;
  elapsedMs?: number;
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

/**
 * Collect the id of every piece that appears anywhere in a set of capture
 * trees, continuations included.
 *
 * This replaces the old isPieceSafe(), which asked the same question per piece
 * by rebuilding every opponent capture tree from scratch — a full move
 * generation per piece, per evaluated node. Same answer, computed once.
 */
function collectThreatenedIds(captureTrees: Map<string, PossibleMove[]>): Set<string> {
  const threatened = new Set<string>();

  const walk = (node: PossibleMove) => {
    for (const captured of node.capturedPieces) threatened.add(captured.id);
    if (node.continuations) for (const child of node.continuations) walk(child);
  };

  for (const trees of captureTrees.values()) {
    for (const tree of trees) walk(tree);
  }

  return threatened;
}

function evaluateBoard(board: BoardType, aiColor: PlayerColor): number {
  let score = 0;
  const opponentColor: PlayerColor = opponentOf(aiColor);

  // Generated once and reused for safety, mobility and threat terms.
  const aiMoves = getAllValidMovesForPlayer(board, aiColor);
  const opponentMoves = getAllValidMovesForPlayer(board, opponentColor);

  // A piece is "unsafe" if the other side can capture it in some sequence.
  const threatenedByAi = collectThreatenedIds(aiMoves.captures);
  const threatenedByOpponent = collectThreatenedIds(opponentMoves.captures);

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
      const isSafe = piece.color === aiColor
        ? !threatenedByOpponent.has(piece.id)
        : !threatenedByAi.has(piece.id);
      if (isSafe) {
        pieceScore += WEIGHTS.SAFE_PIECE;
      }

      score += pieceScore * multiplier;
    }
  }

  // Mobility bonus (number of available moves)
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

// ============================================
// MINIMAX WITH ALPHA-BETA PRUNING
// ============================================

/** Mate-ish score. Kept well above any evaluation the heuristic can produce. */
const WIN_SCORE = 100000;

/**
 * Search moves in a sensible order so alpha-beta actually prunes: longest
 * capture chains first, then promotions, then the rest.
 */
function orderMoves(moves: FullMove[]): FullMove[] {
  return [...moves].sort((a, b) => {
    if (b.captured.length !== a.captured.length) return b.captured.length - a.captured.length;
    if (a.promotes !== b.promotes) return a.promotes ? -1 : 1;
    return 0;
  });
}

function minimax(
  board: BoardType,
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  aiColor: PlayerColor
): number {
  const currentPlayer = maximizingPlayer ? aiColor : opponentOf(aiColor);
  const moves = enumerateMoves(board, currentPlayer);

  // Side to move has nothing legal: they have lost. Prefer quicker wins and
  // slower losses by folding remaining depth into the score.
  if (moves.length === 0) {
    return maximizingPlayer ? -(WIN_SCORE + depth) : WIN_SCORE + depth;
  }

  if (depth === 0) {
    return evaluateBoard(board, aiColor);
  }

  const ordered = orderMoves(moves);

  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (const move of ordered) {
      const evaluation = minimax(applyMove(board, move), depth - 1, alpha, beta, false, aiColor);
      if (evaluation > maxEval) maxEval = evaluation;
      if (evaluation > alpha) alpha = evaluation;
      // One flat loop, so this cutoff actually skips the remaining siblings.
      // The old shape looped per piece and broke only the inner loop, which
      // meant a cutoff still searched every other piece.
      if (beta <= alpha) break;
    }
    return maxEval;
  }

  let minEval = Infinity;
  for (const move of ordered) {
    const evaluation = minimax(applyMove(board, move), depth - 1, alpha, beta, true, aiColor);
    if (evaluation < minEval) minEval = evaluation;
    if (evaluation < beta) beta = evaluation;
    if (beta <= alpha) break;
  }
  return minEval;
}

// ============================================
// MAIN AI FUNCTION
// ============================================

export function calculateAIMove(
  board: BoardType,
  aiColor: PlayerColor,
  difficulty: AIDifficulty
): AIMove | null {
  const startTime = Date.now();

  const moves = enumerateMoves(board, aiColor);
  if (moves.length === 0) return null;

  // Deliberate weakness for the easier tiers: sometimes just don't look.
  // Mandatory capture still applies, so a "blunder" picks a worse capture
  // rather than an illegal move.
  if (difficulty.blunderRate > 0 && Math.random() < difficulty.blunderRate) {
    const move = moves[Math.floor(Math.random() * moves.length)];
    return {
      piece: findPieceById(board, move.pieceId) ?? board[move.from.row][move.from.col]!,
      targetPosition: move.to,
      move,
      score: 0,
      depth: 0,
      elapsedMs: Date.now() - startTime,
    };
  }

  let bestMove: AIMove | null = null;
  let bestScore = -Infinity;
  let alpha = -Infinity;

  for (const move of orderMoves(moves)) {
    const score = minimax(
      applyMove(board, move),
      difficulty.depth - 1,
      alpha,
      Infinity,
      false,
      aiColor
    );

    // Randomness is what makes the easier tiers make mistakes. It is applied
    // only at the root so it perturbs the choice, never the search itself.
    const randomFactor = (Math.random() - 0.5) * difficulty.randomness * 100;
    const adjustedScore = score + randomFactor;

    if (adjustedScore > bestScore) {
      bestScore = adjustedScore;
      // Carry the whole sequence, so the UI replays the exact chain the search
      // chose rather than re-deciding hop by hop.
      bestMove = {
        piece: findPieceById(board, move.pieceId) ?? board[move.from.row][move.from.col]!,
        targetPosition: move.to,
        move,
        score: adjustedScore,
        depth: difficulty.depth,
      };
    }
    // Root alpha still tightens the window for later siblings.
    if (score > alpha) alpha = score;
  }

  if (bestMove) {
    bestMove.elapsedMs = Date.now() - startTime;
  }
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

