/**
 * Gain envelope for one note.
 *
 * `peak` is where the attack ramps to; `decayTarget` is where the decay ramps
 * down to. The decay uses `exponentialRampToValueAtTime`, which constrains both
 * values in ways the original code did not respect.
 */
export interface Envelope {
  peak: number;
  decayTarget: number;
}

/**
 * The quietest gain worth scheduling. Below this a note is inaudible, and the
 * arithmetic behind an exponential ramp starts losing precision.
 */
const SILENCE_THRESHOLD = 1e-5;

/** The decay floor at normal volumes — quiet enough to read as silence. */
const NOMINAL_DECAY_TARGET = 0.001;

/**
 * Build an envelope for a requested gain, or `null` if it would be silent.
 *
 * Two rules an exponential ramp imposes, both of which the original code broke:
 *
 * 1. **It cannot start from zero.** The curve is `v0 * (v1/v0)^t`, so `v0 = 0`
 *    divides by zero. At volume 0 the old code ramped gain to 0 and then called
 *    `exponentialRampToValueAtTime(0.001, …)` from there — undefined behaviour.
 *    Returning `null` means a silent volume schedules nothing at all, which is
 *    both correct and cheaper.
 *
 * 2. **The target has to be below the peak, or it is not a decay.** The old code
 *    used a fixed 0.001 floor. At a master volume under 0.001 — reachable
 *    because chords scale the requested gain down by 0.3 — that floor sat
 *    *above* the peak, so the "decay" ramped the note up and it ended with a
 *    click. The target is now always strictly under the peak.
 */
export function envelopeFor(requestedGain: number): Envelope | null {
  if (!Number.isFinite(requestedGain) || requestedGain <= SILENCE_THRESHOLD) {
    return null;
  }

  const peak = Math.min(requestedGain, 1);

  return {
    peak,
    decayTarget: Math.min(NOMINAL_DECAY_TARGET, peak / 2),
  };
}
