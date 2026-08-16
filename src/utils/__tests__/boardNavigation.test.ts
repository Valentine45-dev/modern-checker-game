import { describe, it, expect } from 'vitest';
import { nextCaptureCandidate, squareRank } from '../boardNavigation';
import { Piece, Position } from '../../types';

const pieceAt = (row: number, col: number, id = `p-${row}-${col}`): Piece => ({
  id,
  color: 'black',
  type: 'normal',
  position: { row, col },
});

const cursor = (row: number, col: number): Position => ({ row, col });

describe('nextCaptureCandidate', () => {
  it('returns null when nothing can capture', () => {
    expect(nextCaptureCandidate([], cursor(0, 1))).toBeNull();
  });

  it('always lands on the only candidate', () => {
    const only = pieceAt(5, 0);
    // Wherever the cursor sits, including on the piece itself.
    expect(nextCaptureCandidate([only], cursor(0, 1))?.id).toBe(only.id);
    expect(nextCaptureCandidate([only], cursor(7, 7))?.id).toBe(only.id);
    expect(nextCaptureCandidate([only], cursor(5, 0))?.id).toBe(only.id);
  });

  it('picks the first candidate after the cursor in reading order', () => {
    const first = pieceAt(5, 0);
    const second = pieceAt(5, 6);

    expect(nextCaptureCandidate([first, second], cursor(0, 1))?.id).toBe(first.id);
  });

  it('advances rather than sticking when the cursor is already on a candidate', () => {
    const first = pieceAt(5, 0);
    const second = pieceAt(5, 6);

    expect(nextCaptureCandidate([first, second], first.position)?.id).toBe(second.id);
  });

  it('wraps to the first candidate past the last one', () => {
    const first = pieceAt(5, 0);
    const second = pieceAt(5, 6);

    expect(nextCaptureCandidate([first, second], second.position)?.id).toBe(first.id);
  });

  it('cycles through every candidate and returns to the start', () => {
    const candidates = [pieceAt(1, 0), pieceAt(3, 4), pieceAt(6, 2)];

    const visited: string[] = [];
    let at = cursor(0, 0);
    for (let i = 0; i < candidates.length + 1; i++) {
      const next = nextCaptureCandidate(candidates, at)!;
      visited.push(next.id);
      at = next.position;
    }

    expect(visited).toEqual([
      candidates[0].id,
      candidates[1].id,
      candidates[2].id,
      candidates[0].id, // wrapped
    ]);
  });

  it('steps backwards with shift', () => {
    const first = pieceAt(1, 0);
    const second = pieceAt(6, 2);

    expect(nextCaptureCandidate([first, second], second.position, true)?.id).toBe(first.id);
  });

  it('wraps backwards to the last candidate', () => {
    const first = pieceAt(1, 0);
    const second = pieceAt(6, 2);

    // Nothing sits before the first candidate, so it comes round to the last.
    expect(nextCaptureCandidate([first, second], first.position, true)?.id).toBe(second.id);
  });

  it('orders squares by row then column', () => {
    expect(squareRank({ row: 0, col: 7 })).toBeLessThan(squareRank({ row: 1, col: 0 }));
  });
});
