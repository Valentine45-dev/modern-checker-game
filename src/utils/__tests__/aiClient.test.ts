import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createInitialBoard } from '../rules';

/**
 * The worker must never be able to hold a turn open forever.
 *
 * `requestAIMove` used to settle only when the worker replied or fired `error`.
 * A worker that did neither — one throttled in a hidden tab, or killed without
 * notifying the page — left the promise pending, so the caller's `finally` never
 * ran and the flag marking "a search owns this turn" was never released. The
 * board then refused every click on the player's own turn until a reload.
 */

/** A worker that accepts messages and never answers. */
class SilentWorker {
  postMessage() {}
  addEventListener() {}
  terminate() {}
}

/** A worker that answers normally, so the happy path is still covered. */
class ReplyingWorker {
  private handlers: ((event: { data: unknown }) => void)[] = [];
  addEventListener(type: string, handler: (event: { data: unknown }) => void) {
    if (type === 'message') this.handlers.push(handler);
  }
  postMessage(request: { id: number }) {
    queueMicrotask(() => {
      for (const h of this.handlers) h({ data: { id: request.id, move: null } });
    });
  }
  terminate() {}
}

async function loadClient() {
  return import('../aiClient');
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('requestAIMove', () => {
  it('settles even when the worker never answers', async () => {
    vi.stubGlobal('Worker', SilentWorker);
    const { requestAIMove } = await loadClient();

    const difficulty = { depth: 1, maxDepth: 1, thinkingTime: 0, randomness: 0, blunderRate: 0 };
    const promise = requestAIMove(createInitialBoard(), 'red', difficulty);

    let settled = false;
    void promise.then(() => { settled = true; });

    // Nothing should resolve while the worker is merely slow.
    await Promise.resolve();
    expect(settled).toBe(false);

    // Past the deadline it falls back to computing in-process rather than
    // leaving the caller — and the turn — hanging.
    await vi.advanceTimersByTimeAsync(11_000);
    const move = await promise;

    expect(settled).toBe(true);
    expect(move).not.toBeNull();
  });

  it('resolves from the worker when it does answer', async () => {
    vi.stubGlobal('Worker', ReplyingWorker);
    const { requestAIMove } = await loadClient();

    const difficulty = { depth: 1, maxDepth: 1, thinkingTime: 0, randomness: 0, blunderRate: 0 };
    const move = await requestAIMove(createInitialBoard(), 'red', difficulty);

    // The stub reports "no move", which is what should come back untouched.
    expect(move).toBeNull();
  });

  it('falls back in-process when workers do not exist at all', async () => {
    vi.stubGlobal('Worker', undefined);
    const { requestAIMove } = await loadClient();

    const difficulty = { depth: 1, maxDepth: 1, thinkingTime: 0, randomness: 0, blunderRate: 0 };
    const move = await requestAIMove(createInitialBoard(), 'red', difficulty);

    expect(move).not.toBeNull();
  });
});
