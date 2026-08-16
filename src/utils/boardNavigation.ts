import { Piece, Position } from '../types';

/** Reading order: left to right, top to bottom. */
export function squareRank(position: Position): number {
  return position.row * 8 + position.col;
}

/**
 * The next piece the capture shortcut should jump to.
 *
 * With more than one piece able to capture there is no way to know which one the
 * player means, so this does not guess: it steps to the next candidate in
 * reading order and wraps, the way find-next works. Repeated presses walk the
 * whole set, which turns "which of the two?" from a problem into the ordinary
 * case.
 *
 * The comparison is strict, so a cursor already sitting on a candidate advances
 * to the next one instead of sticking.
 */
export function nextCaptureCandidate(
  candidates: Piece[],
  cursor: Position,
  backwards = false
): Piece | null {
  if (candidates.length === 0) return null;

  const from = squareRank(cursor);

  if (backwards) {
    for (let i = candidates.length - 1; i >= 0; i--) {
      if (squareRank(candidates[i].position) < from) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  for (const candidate of candidates) {
    if (squareRank(candidate.position) > from) return candidate;
  }
  return candidates[0];
}
