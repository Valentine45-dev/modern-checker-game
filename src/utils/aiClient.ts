import { calculateAIMove, type AIDifficulty, type AIMove } from './aiEngine';
import type { Board as BoardType, PlayerColor } from '../types';
import type { AIRequest, AIResponse } from './aiWorker';

/**
 * Asks the AI for a move, off the main thread when possible.
 *
 * The search used to run synchronously in the click handler, so the board could
 * not repaint while it thought — measured at ~114ms per turn at depth 6 and
 * ~466ms at depth 7. Moving it to a worker frees the main thread, which is what
 * makes the deeper search affordable.
 *
 * Falls back to running in-process if workers are unavailable or the worker
 * fails, so the game always gets a move.
 */

let worker: Worker | null = null;
let workerUnavailable = false;
let nextRequestId = 1;

const pending = new Map<number, (response: AIResponse) => void>();

function getWorker(): Worker | null {
  if (workerUnavailable) return null;
  if (worker) return worker;

  if (typeof Worker === 'undefined') {
    workerUnavailable = true;
    return null;
  }

  try {
    worker = new Worker(new URL('./aiWorker.ts', import.meta.url), { type: 'module' });

    worker.addEventListener('message', (event: MessageEvent<AIResponse>) => {
      const resolve = pending.get(event.data.id);
      if (resolve) {
        pending.delete(event.data.id);
        resolve(event.data);
      }
    });

    worker.addEventListener('error', (event) => {
      console.warn('AI worker failed, falling back to the main thread:', event.message);
      // Unblock anything waiting, then stop using the worker.
      for (const [id, resolve] of pending) resolve({ id, move: null, error: 'worker-error' });
      pending.clear();
      workerUnavailable = true;
      worker?.terminate();
      worker = null;
    });
  } catch (error) {
    console.warn('Could not start the AI worker, using the main thread:', error);
    workerUnavailable = true;
    worker = null;
  }

  return worker;
}

export function requestAIMove(
  board: BoardType,
  aiColor: PlayerColor,
  difficulty: AIDifficulty
): Promise<AIMove | null> {
  const activeWorker = getWorker();

  if (!activeWorker) {
    return Promise.resolve(calculateAIMove(board, aiColor, difficulty));
  }

  const id = nextRequestId++;
  const request: AIRequest = { id, board, aiColor, difficulty };

  return new Promise<AIMove | null>((resolve) => {
    pending.set(id, (response) => {
      if (response.error) {
        // The worker could not answer; compute it here instead of losing a turn.
        console.warn('AI worker error, recomputing on the main thread:', response.error);
        resolve(calculateAIMove(board, aiColor, difficulty));
        return;
      }
      resolve(response.move);
    });

    activeWorker.postMessage(request);
  });
}

/** Test/debug helper: is the search actually running off the main thread? */
export function isWorkerActive(): boolean {
  return worker !== null && !workerUnavailable;
}
