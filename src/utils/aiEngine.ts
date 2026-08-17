import { Piece, Position, PlayerColor, Board as BoardType, PossibleMove } from '../types';
import {
  getAllValidMovesForPlayer,
  enumerateMoves,
  applyMove,
  findPieceById,
  opponentOf,
  hashPosition,
  type FullMove,
} from './rules';

// AI difficulty settings
export interface AIDifficulty {
  /**
   * Plies of search that are always completed, whatever the clock says. The
   * floor for iterative deepening, so a tier can never play weaker than this.
   */
  depth: number;
  /**
   * Ceiling for iterative deepening. Omit, or set equal to `depth`, to search a
   * fixed depth and nothing deeper.
   *
   * Depth is not one cost — it depends entirely on how many pieces are left. The
   * tree is enormous at 24 pieces and collapses to a handful of moves at six, so
   * a depth that is expensive in the midgame is nearly free in an endgame. A
   * fixed depth spends the same plies in both and leaves that headroom unused.
   */
  maxDepth?: number;
  /**
   * Wall-clock budget for the whole search, in milliseconds. Iterations past
   * `depth` are abandoned when it runs out, and the last completed depth is
   * played. Ignored when there is nothing deeper to try.
   */
  timeBudgetMs?: number;
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
 * engine each rung scores strictly better than the one below it, and Hard beats
 * a correct engine searching to its own depth.
 *
 * Hard runs at depth 7, which beats a correct engine searching to its own depth
 * 7 and scores 100% against a depth-6 one (depth 6 manages 75%).
 *
 * Depth 7 was rejected once already: on the main thread it stalled the browser
 * for 466ms per move, even though headless timings suggested 175ms. It is
 * affordable now only because the search runs in a Web Worker, so its cost no
 * longer lands on the thread that paints the board — and because it overlaps
 * with the thinking delay the player is already waiting through.
 *
 * Anything deeper should be justified by measuring in the browser, not headless.
 * Node under-predicted the real cost by roughly 2.7x last time.
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
    depth: 7,
    // Only Hard deepens. Easy and Medium keep a fixed depth on purpose: they are
    // meant to be beatable, and letting them think harder in the endgame would
    // quietly undo that.
    maxDepth: 24,
    // Hard already paces at 900ms and the search runs on a worker alongside that
    // wait, so anything inside this budget is invisible to the player. Measured
    // median at depth 7 was 298ms, leaving most of the budget unspent.
    timeBudgetMs: 900,
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
/**
 * Evaluation weights, in centipawns: a man is 100.
 *
 * These were previously hand-nudged — every comment read "Increased X
 * importance" — and never measured. They are now the outcome of ~13,000 games
 * of self-play at fixed depth, each configuration against the shipped engine
 * over varied openings with colours swapped. See audit.md §29 for the runs.
 *
 * Four values changed. The other five were tested and left alone: EDGE_PENALTY
 * measured as already optimal (both directions lost), MOBILITY's apparent gain
 * did not survive a wider range, and PIECE, SAFE_PIECE and CAPTURE_THREAT
 * showed no measurable effect either way.
 */
const WEIGHTS = {
  PIECE: 100,
  // 1.8x a man was too cheap for *flying* kings, which are far stronger than
  // the short-range kind. Measured peak: 300 (54.8%), falling away by 440.
  KING: 300,
  // Defending the back row is worth more than it was paid. Peak at 35 (56.3%);
  // 50 and 70 give the gain back.
  BACK_ROW: 35,
  // Counter-intuitive, and the largest single effect found. The bonus applies to
  // any piece in the middle 4x4 whether or not it is supported, so a high value
  // pays pieces to sit in contested squares and be traded off. 5 scored 56.8%,
  // 30 scored 46.7%.
  MIDDLE_CONTROL: 5,
  // At 8 per row a man seven rows up was worth +56 — over half a piece — purely
  // for being near promotion, which bought races that were not worth entering.
  // Monotone across 12/8/4/2: 47.0 / 50 / 54.0 / 55.7%.
  ADVANCED_POSITION: 2,
  EDGE_PENALTY: -15,
  SAFE_PIECE: 10,
  MOBILITY: 5,
  CAPTURE_THREAT: 15,
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

  // A "trade down when ahead" term was tried here — scaling the material lead by
  // how many pieces had come off, so exchanges look good when winning and bad
  // when losing. It measured as nothing at all: 50.3 / 50.8 / 49.5 / 50.0% over
  // 1,200 games across an 8x range of weights. The reasoning was sound but the
  // search already sees those positions concretely at these depths, so it does
  // not need the hint. Removed rather than shipped inert.

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

/**
 * How many extra forced-capture plies quiescence may follow past the nominal
 * depth. Chains shorten material every ply so this terminates on its own; the
 * cap only guards against a pathological position.
 */
const QUIESCENCE_LIMIT = 4;

/**
 * Keep searching until the position is quiet, then evaluate.
 *
 * Stopping the search in the middle of an exchange is how an engine convinces
 * itself that giving a piece away is fine — it counts the loss but never sees
 * the recapture. Because captures are mandatory in this variant, "quiet" has an
 * exact meaning: the side to move has no capture available. While it does have
 * one it has no choice, so there is nothing to stand pat on and every line must
 * be followed to its end.
 */
function quiescence(
  board: BoardType,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  aiColor: PlayerColor,
  limit: number
): number {
  checkDeadline();

  const currentPlayer = maximizingPlayer ? aiColor : opponentOf(aiColor);
  const moves = enumerateMoves(board, currentPlayer);

  if (moves.length === 0) {
    return maximizingPlayer ? -WIN_SCORE : WIN_SCORE;
  }

  // Mandatory capture means either every move is a capture, or none is.
  const forcedToCapture = moves[0].isCapture;
  if (!forcedToCapture || limit === 0) {
    return evaluateBoard(board, aiColor);
  }

  const ordered = orderMoves(moves);

  if (maximizingPlayer) {
    let best = -Infinity;
    for (const move of ordered) {
      const value = quiescence(applyMove(board, move), alpha, beta, false, aiColor, limit - 1);
      if (value > best) best = value;
      if (value > alpha) alpha = value;
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const move of ordered) {
    const value = quiescence(applyMove(board, move), alpha, beta, true, aiColor, limit - 1);
    if (value < best) best = value;
    if (value < beta) beta = value;
    if (beta <= alpha) break;
  }
  return best;
}

/**
 * Transposition table.
 *
 * The same position is reached by many move orders, so without this the search
 * re-explores identical subtrees repeatedly. Entries are only reusable at the
 * depth they were searched to or deeper, and the stored bound has to be
 * respected: a value produced under a cutoff is a bound, not the true score.
 */
type BoundKind = 'exact' | 'lower' | 'upper';
interface TableEntry {
  depth: number;
  value: number;
  bound: BoundKind;
}

const transpositionTable = new Map<string, TableEntry>();
/** Cleared per root search, so it never grows without limit across a game. */
const MAX_TABLE_ENTRIES = 200_000;

/**
 * Thrown to unwind out of a search whose time has run out. The half-finished
 * iteration is discarded and the last completed depth is played, so an abandoned
 * search can never produce a worse move than the one already in hand.
 */
const SEARCH_ABORTED = Symbol('search aborted');

let searchDeadline = Infinity;
let nodesVisited = 0;

/**
 * Give up if the budget is spent.
 *
 * Only sampled every 1024 nodes: `Date.now()` at every node costs more than the
 * abort saves. At these node rates that is well under a millisecond of overrun.
 */
function checkDeadline(): void {
  if ((++nodesVisited & 1023) === 0 && Date.now() >= searchDeadline) {
    throw SEARCH_ABORTED;
  }
}

function minimax(
  board: BoardType,
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  aiColor: PlayerColor
): number {
  checkDeadline();

  const currentPlayer = maximizingPlayer ? aiColor : opponentOf(aiColor);

  const key = hashPosition(board, currentPlayer);
  const cached = transpositionTable.get(key);
  if (cached && cached.depth >= depth) {
    // An exact score is usable as-is. A bound is only usable when it already
    // falls outside the window we are searching.
    if (cached.bound === 'exact') return cached.value;
    if (cached.bound === 'lower' && cached.value >= beta) return cached.value;
    if (cached.bound === 'upper' && cached.value <= alpha) return cached.value;
  }

  const moves = enumerateMoves(board, currentPlayer);

  // Side to move has nothing legal: they have lost. Prefer quicker wins and
  // slower losses by folding remaining depth into the score.
  if (moves.length === 0) {
    return maximizingPlayer ? -(WIN_SCORE + depth) : WIN_SCORE + depth;
  }

  if (depth === 0) {
    return quiescence(board, alpha, beta, maximizingPlayer, aiColor, QUIESCENCE_LIMIT);
  }

  const originalAlpha = alpha;
  const originalBeta = beta;
  const ordered = orderMoves(moves);

  let best: number;

  if (maximizingPlayer) {
    best = -Infinity;
    for (const move of ordered) {
      const evaluation = minimax(applyMove(board, move), depth - 1, alpha, beta, false, aiColor);
      if (evaluation > best) best = evaluation;
      if (evaluation > alpha) alpha = evaluation;
      // One flat loop, so this cutoff actually skips the remaining siblings.
      // The old shape looped per piece and broke only the inner loop, which
      // meant a cutoff still searched every other piece.
      if (beta <= alpha) break;
    }
  } else {
    best = Infinity;
    for (const move of ordered) {
      const evaluation = minimax(applyMove(board, move), depth - 1, alpha, beta, true, aiColor);
      if (evaluation < best) best = evaluation;
      if (evaluation < beta) beta = evaluation;
      if (beta <= alpha) break;
    }
  }

  // Record what kind of value this is. A score that lands outside the window we
  // searched is only a bound, whichever kind of node produced it — a max node
  // can fail low and a min node can fail high. Labelling either as exact
  // poisons later lookups, which showed up as the search losing games it had
  // previously drawn.
  let bound: BoundKind = 'exact';
  if (best <= originalAlpha) bound = 'upper';
  else if (best >= originalBeta) bound = 'lower';

  if (transpositionTable.size < MAX_TABLE_ENTRIES) {
    transpositionTable.set(key, { depth, value: best, bound });
  }

  return best;
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

  // Entries are only valid for the position they were computed from, and the
  // board has moved on since the last turn. Cheaper and safer than ageing them.
  transpositionTable.clear();

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

  const ordered = orderMoves(moves);

  /**
   * Search every root move to one fixed depth.
   *
   * Throws SEARCH_ABORTED if the deadline passes part-way through, in which case
   * the caller keeps whatever the previous depth returned.
   */
  const searchToDepth = (depth: number): AIMove | null => {
    let best: AIMove | null = null;
    let bestScore = -Infinity;
    let alpha = -Infinity;

    for (const move of ordered) {
      const score = minimax(applyMove(board, move), depth - 1, alpha, Infinity, false, aiColor);

      // Randomness is what makes the easier tiers make mistakes. It is applied
      // only at the root so it perturbs the choice, never the search itself.
      const randomFactor = (Math.random() - 0.5) * difficulty.randomness * 100;
      const adjustedScore = score + randomFactor;

      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        // Carry the whole sequence, so the UI replays the exact chain the search
        // chose rather than re-deciding hop by hop.
        best = {
          piece: findPieceById(board, move.pieceId) ?? board[move.from.row][move.from.col]!,
          targetPosition: move.to,
          move,
          score: adjustedScore,
          depth,
        };
      }
      // Root alpha still tightens the window for later siblings.
      if (score > alpha) alpha = score;
    }

    return best;
  };

  /**
   * Iterative deepening.
   *
   * Deliberately starts *at* the configured depth rather than at 1. This engine
   * does not use the transposition table for move ordering, so the shallow
   * warm-up passes that normally pay for themselves would here be pure overhead.
   * Starting at the floor means the first iteration is exactly the search that
   * shipped before, and every iteration after it is spare time that used to go
   * unused — so this can add strength but cannot subtract any.
   */
  const ceiling = Math.max(difficulty.depth, difficulty.maxDepth ?? difficulty.depth);
  const budget = difficulty.timeBudgetMs;

  let bestMove: AIMove | null = null;

  for (let depth = difficulty.depth; depth <= ceiling; depth++) {
    // The floor is guaranteed; only the extra iterations answer to the clock.
    searchDeadline = depth === difficulty.depth || budget === undefined
      ? Infinity
      : startTime + budget;

    try {
      const result = searchToDepth(depth);
      if (result) bestMove = result;
    } catch (error) {
      if (error === SEARCH_ABORTED) break;
      throw error;
    }

    // A forced result is already proven; more depth cannot improve on it.
    if (bestMove && Math.abs(bestMove.score) >= WIN_SCORE) break;

    if (budget !== undefined) {
      const spent = Date.now() - startTime;
      // Each extra ply costs several times the last, so an iteration started
      // with only a sliver of the budget left is one that will be thrown away.
      if (spent >= budget * 0.4) break;
    }
  }

  searchDeadline = Infinity;

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

