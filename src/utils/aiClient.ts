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

/**
 * How long to wait for the worker before giving up on it.
 *
 * This promise used to settle only when the worker replied or fired `error`. A
 * worker that did neither — a browser throttling it in a hidden tab, or one that
 * died without notifying the page — left the promise pending forever. The caller
 * awaits it, so its `finally` never ran and the flag marking "a search owns this
 * turn" was never released: the board then refused every click on the player's
 * own turn, and only a reload recovered it.
 *
 * Generous, because a legitimate deep search plus a slow machine is normal. The
 * point is only that the wait is finite.
 */
const WORKER_TIMEOUT_MS = 10_000;

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
    let settled = false;

    // Every exit runs through here, so the promise resolves exactly once and the
    // pending entry and timer are always cleaned up. Declared before `timer` and
    // only ever called after it exists.
    function settle(move: AIMove | null) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      pending.delete(id);
      resolve(move);
    }

    pending.set(id, (response) => {
      if (response.error) {
        // The worker could not answer; compute it here instead of losing a turn.
        console.warn('AI worker error, recomputing on the main thread:', response.error);
        settle(calculateAIMove(board, aiColor, difficulty));
        return;
      }
      settle(response.move);
    });

    const timer = setTimeout(() => {
      console.warn('AI worker did not answer in time; recomputing on the main thread');
      settle(calculateAIMove(board, aiColor, difficulty));
    }, WORKER_TIMEOUT_MS);

    try {
      activeWorker.postMessage(request);
    } catch (error) {
      // Posting can throw outright if the request will not clone.
      console.warn('Could not send the position to the AI worker:', error);
      settle(calculateAIMove(board, aiColor, difficulty));
    }
  });
}

/** Test/debug helper: is the search actually running off the main thread? */
export function isWorkerActive(): boolean {
  return worker !== null && !workerUnavailable;
}
