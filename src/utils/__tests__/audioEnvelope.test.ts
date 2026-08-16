import { describe, it, expect } from 'vitest';
import { envelopeFor } from '../audioEnvelope';

describe('envelopeFor', () => {
  it('schedules nothing at zero volume', () => {
    // The bug this replaces: gain was ramped to 0 and then handed to
    // exponentialRampToValueAtTime, which is undefined from zero.
    expect(envelopeFor(0)).toBeNull();
  });

  it('schedules nothing for a negative or non-finite gain', () => {
    expect(envelopeFor(-1)).toBeNull();
    expect(envelopeFor(Number.NaN)).toBeNull();
    expect(envelopeFor(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('keeps the decay target strictly between zero and the peak', () => {
    for (const gain of [1, 0.5, 0.15, 0.01, 0.002, 0.0005, 0.0001]) {
      const envelope = envelopeFor(gain);
      expect(envelope, `gain ${gain}`).not.toBeNull();
      expect(envelope!.decayTarget, `gain ${gain}`).toBeGreaterThan(0);
      expect(envelope!.decayTarget, `gain ${gain}`).toBeLessThan(envelope!.peak);
    }
  });

  it('decays rather than swelling at very low volumes', () => {
    // A fixed 0.001 floor sat above the peak here, so the note ramped UP and
    // ended on a click. Chords reach this range at a low master volume because
    // they scale the requested gain down.
    const envelope = envelopeFor(0.0005)!;
    expect(envelope.decayTarget).toBeLessThan(envelope.peak);
  });

  it('uses the nominal floor at ordinary volumes', () => {
    expect(envelopeFor(0.5)!.decayTarget).toBe(0.001);
  });

  it('never exceeds full scale', () => {
    // Not reachable through setVolume, which clamps, but the ceiling belongs
    // with the rest of the envelope's guarantees rather than at the call site.
    expect(envelopeFor(4)!.peak).toBe(1);
  });
});
