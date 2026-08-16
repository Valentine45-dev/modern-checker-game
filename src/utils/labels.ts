/**
 * Human-readable strings shared by more than one component.
 */

/**
 * Spoken form of a capture tally, used by the in-game info card and the
 * game-over summary so both phrase it identically.
 *
 * The count belongs to the player who *took* the pieces. A bare number beside a
 * red disc reads as red pieces lost — the opposite of what it means — so the
 * wording has to name the owner of the tally.
 */
export const capturedLabel = (player: string, count: number): string =>
  `${player} has captured ${count} ${count === 1 ? 'piece' : 'pieces'}`;
