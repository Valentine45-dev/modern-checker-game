import { describe, it, expect } from 'vitest';
import { parseSavedGame, SAVE_SCHEMA_VERSION } from '../gamePersistence';
import { createInitialBoard } from '../rules';

/** A save that should round-trip cleanly. */
function validSave(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    board: createInitialBoard(),
    currentPlayer: 'black',
    selectedPiece: null,
    validMoves: [],
    possibleCaptures: [],
    moveHistory: [],
    score: { red: 0, black: 0 },
    capturedPieces: { red: [], black: [] },
    gameStatus: 'playing',
    gameMode: 'ai-hard',
    mustCapture: false,
    playerTimers: { red: 300, black: 300 },
    turnStartTime: Date.now(),
    turnNumber: 1,
    gameStartTime: Date.now(),
    kingsPromoted: { red: 0, black: 0 },
    multiJumpInProgress: false,
    currentJumpPiece: null,
    accumulatedCaptures: [],
    chainOrigin: null,
    aiThinking: false,
    piecesWithCaptures: [],
    boardTheme: 'classic',
    pieceStyle: 'standard',
    ...overrides,
  };
}

const serialise = (save: unknown) => JSON.stringify(save);

describe('parseSavedGame', () => {
  it('accepts a well-formed save at the current version', () => {
    const parsed = parseSavedGame(serialise(validSave()));
    expect(parsed).not.toBeNull();
    expect(parsed!.gameMode).toBe('ai-hard');
    expect(parsed!.currentPlayer).toBe('black');
  });

  it('returns null for nothing stored', () => {
    expect(parseSavedGame(null)).toBeNull();
    expect(parseSavedGame('')).toBeNull();
  });

  it('returns null for malformed JSON instead of throwing', () => {
    expect(parseSavedGame('{ not json')).toBeNull();
    expect(parseSavedGame('"a string"')).toBeNull();
    expect(parseSavedGame('null')).toBeNull();
  });
});

describe('schema versioning', () => {
  it('rejects a save with no version at all', () => {
    // Every save written before versioning existed looks like this.
    const legacy = validSave();
    delete (legacy as Record<string, unknown>).schemaVersion;
    expect(parseSavedGame(serialise(legacy))).toBeNull();
  });

  it('rejects an older version', () => {
    expect(parseSavedGame(serialise(validSave({ schemaVersion: SAVE_SCHEMA_VERSION - 1 })))).toBeNull();
  });

  it('rejects a newer version', () => {
    // A save written by a future build must not be half-read by this one.
    expect(parseSavedGame(serialise(validSave({ schemaVersion: SAVE_SCHEMA_VERSION + 1 })))).toBeNull();
  });
});

describe('structural validation', () => {
  it('rejects a board that is not 8x8', () => {
    expect(parseSavedGame(serialise(validSave({ board: [] })))).toBeNull();
    expect(parseSavedGame(serialise(validSave({ board: createInitialBoard().slice(0, 5) })))).toBeNull();
  });

  it('rejects a truncated row', () => {
    const board = createInitialBoard();
    board[3] = board[3].slice(0, 4);
    expect(parseSavedGame(serialise(validSave({ board })))).toBeNull();
  });

  it('rejects a malformed piece', () => {
    const board = createInitialBoard();
    // A piece missing its position — the old check let this through and the
    // game crashed when it tried to render.
    board[0][1] = { id: 'red-1', color: 'red', type: 'normal' } as never;
    expect(parseSavedGame(serialise(validSave({ board })))).toBeNull();
  });

  it('rejects a piece with an unknown colour or type', () => {
    const badColour = createInitialBoard();
    badColour[0][1] = { id: 'x', color: 'green', type: 'normal', position: { row: 0, col: 1 } } as never;
    expect(parseSavedGame(serialise(validSave({ board: badColour })))).toBeNull();

    const badType = createInitialBoard();
    badType[0][1] = { id: 'x', color: 'red', type: 'wizard', position: { row: 0, col: 1 } } as never;
    expect(parseSavedGame(serialise(validSave({ board: badType })))).toBeNull();
  });

  it('rejects unknown enum values', () => {
    expect(parseSavedGame(serialise(validSave({ currentPlayer: 'green' })))).toBeNull();
    expect(parseSavedGame(serialise(validSave({ gameMode: 'ai-impossible' })))).toBeNull();
    expect(parseSavedGame(serialise(validSave({ gameStatus: 'exploded' })))).toBeNull();
  });

  it('rejects a missing or malformed score', () => {
    expect(parseSavedGame(serialise(validSave({ score: undefined })))).toBeNull();
    expect(parseSavedGame(serialise(validSave({ score: { red: 'lots', black: 0 } })))).toBeNull();
  });

  it('rejects a move history that is not an array', () => {
    expect(parseSavedGame(serialise(validSave({ moveHistory: 'none' })))).toBeNull();
  });

  it('accepts an empty board, which is structurally valid', () => {
    // A finished game can legitimately have one side wiped out; only the shape
    // is being checked here, not whether the position makes sense.
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    expect(parseSavedGame(serialise(validSave({ board })))).not.toBeNull();
  });
});
