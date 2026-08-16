import { describe, it, expect } from 'vitest';
import { capturedLabel } from '../labels';

describe('capturedLabel', () => {
  it('names the player who took the pieces, not the colour of the pieces', () => {
    expect(capturedLabel('Black player', 3)).toBe('Black player has captured 3 pieces');
  });

  it('uses the singular for exactly one piece', () => {
    expect(capturedLabel('AI', 1)).toBe('AI has captured 1 piece');
  });

  it('uses the plural for none', () => {
    expect(capturedLabel('Red player', 0)).toBe('Red player has captured 0 pieces');
  });
});
