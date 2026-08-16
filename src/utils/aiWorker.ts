import { calculateAIMove, type AIDifficulty, type AIMove } from './aiEngine';
import type { Board as BoardType, PlayerColor } from '../types';

/**
 * Runs the search off the main thread.
 *
 * The engine is a pure function over plain arrays — no React, no DOM, no
 * localStorage — so it can be moved here as-is. That is a direct payoff of
 * extracting the rules out of the Game component earlier; before that the move
 * generation lived inside a React component and could not have been used here.
 */

export interface AIRequest {
  id: number;
  board: BoardType;
  aiColor: PlayerColor;
  difficulty: AIDifficulty;
}

export interface AIResponse {
  id: number;
  move: AIMove | null;
  error?: string;
}

// `self` is typed as Window under the DOM lib. Casting to just the two members
// a worker needs avoids pulling the WebWorker lib into the whole app's types.
const ctx = self as unknown as {
  postMessage: (message: AIResponse) => void;
  addEventListener: (type: 'message', listener: (event: MessageEvent<AIRequest>) => void) => void;
};

ctx.addEventListener('message', (event) => {
  const { id, board, aiColor, difficulty } = event.data;

  try {
    const move = calculateAIMove(board, aiColor, difficulty);
    ctx.postMessage({ id, move });
  } catch (error) {
    // Never leave the caller hanging: report and let it fall back.
    ctx.postMessage({
      id,
      move: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
