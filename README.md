# Checkers

A checkers game built with React, TypeScript and Vite, featuring a minimax AI with
alpha-beta pruning, quiescence search and a transposition table, running off the main
thread in a Web Worker.

Play locally against a friend, or against one of three AI difficulties.

---

## Getting started

**Requirements:** Node.js 18 or newer.

```bash
git clone https://github.com/Valentine45-dev/modern-checker-game.git
cd modern-checker-game
npm install
npm run dev
```

The dev server runs at `http://localhost:5173`.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Lint (fails on any warning) |
| `npm run type-check` | Type-check without emitting |

---

## Rules

An 8×8 board using international-style rules, closest to Brazilian draughts:

- **Men** move one square diagonally forward, and capture diagonally in **all four
  directions**, including backwards.
- **Kings** are flying kings: they move and capture any distance along a clear diagonal.
- **Capturing is mandatory.** If any capture is available, no quiet move is legal.
- **Multi-jumps** continue for as long as the capturing piece can keep taking.
- **Promotion** happens when a man finishes its move on the far rank.
- A player loses when they have no pieces left, or no legal move.

Two deliberate house rules, worth knowing if you are used to tournament play:

- **Promotion ends the turn.** A man that lands on the far rank mid-sequence crowns and
  stops, rather than continuing as a king.
- **Maximum capture is not enforced.** Any legal capture may be taken, not only the one
  that captures the most pieces.

### Taking a multi-jump

Either interaction works, and both produce exactly the same result:

- Click each landing square in turn, one jump at a time, or
- Click the **final** square of the sequence to play the whole chain at once.

---

## Playing with a keyboard

The board is a single tab stop, not sixty-four. Tab to it, then:

| Key | Action |
| --- | --- |
| Arrow keys | Move the cursor one square |
| Enter or Space | Select a piece, then play a move |
| C | Jump to a piece that can capture, and select it. Press again for the next one |
| Shift + C | Same, cycling backwards |
| Escape | Clear the selection |
| Tab | Leave the board for the sidebar controls |

Captures are mandatory, so when one exists those pieces are the only ones that can be
played at all. `C` cycles through them in reading order and wraps, rather than guessing
which one you meant — finding them by arrowing across the board otherwise means crossing
up to sixty-four squares.

Escape deliberately refuses part-way through a multi-jump, because the rest of a capture
sequence is mandatory.

Every square announces what it holds, so the board can be read without seeing it:

```
B6, red piece
B6, red piece, selected
A5, empty, available move
B5, unplayable square
```

Known gap: there is no live region describing the opponent's move. A move raises a toast,
which is announced, but it does not say which squares were involved.

---

## The AI

A minimax search with alpha-beta pruning over complete capture sequences.

| | Search depth | Deliberate mistakes | Thinking time |
| --- | --- | --- | --- |
| **Easy** | 2 ply | 35% of moves are random | ~450 ms |
| **Medium** | 4 ply | 8% of moves are random | ~750 ms |
| **Hard** | 7 ply | none | ~900 ms |

The easier tiers are weakened on purpose through a `blunderRate` — the chance of ignoring
the search entirely and playing a random legal move — rather than by relying on a shallow
search to be wrong in interesting ways. Mandatory capture still applies, so a "blunder"
picks a worse capture rather than an illegal move.

### How the search works

- **Complete-sequence move generation.** A move is a whole turn, including every hop and
  every piece it captures, so a triple capture is evaluated as a triple capture.
- **Quiescence search.** Because captures are mandatory, a position is "quiet" precisely
  when the side to move has no capture. The search follows forced exchanges to the end
  before evaluating, so it never scores a position mid-trade.
- **Move ordering.** Longest capture chains first, then promotions, so alpha-beta prunes
  effectively.
- **Transposition table.** Positions are keyed by a Zobrist hash of the board plus the side
  to move, with entries tagged as exact scores or as bounds.
- **Web Worker.** The search runs on a separate thread and is issued in parallel with the
  thinking delay, so the pause the player already sees absorbs the computation and the
  board never blocks. Falls back to in-process computation if workers are unavailable.

### Strength

Measured against a fixed, independently written reference engine, alternating colours:

| AI difficulty | vs reference depth 5 | vs reference depth 6 |
| --- | --- | --- |
| Easy | 0% | 0% |
| Medium | 45% | 25% |
| Hard | 100% | 100% |

Hard also scores 100% against a reference searching to its own depth of 7.

### Evaluation tuning

The positional weights were tuned by self-play rather than by hand. Each candidate played
the shipped engine over varied random openings, every opening played twice with colours
swapped, across roughly 13,000 games. Four weights changed:

| Weight | Was | Now | Effect |
| --- | --- | --- | --- |
| `KING` | 180 | 300 | 54.8% |
| `BACK_ROW` | 20 | 35 | 56.3% |
| `MIDDLE_CONTROL` | 15 | 5 | 56.8% |
| `ADVANCED_POSITION` | 8 | 2 | 55.7% |

Together they score **57.8%** against the previous weights at depth 4 and **58.3%** at
depth 6, over 500 and 240 games respectively — roughly a 55-point Elo gain. The remaining
weights were tested and left alone: `EDGE_PENALTY` measured as already optimal, and
`MOBILITY`, `SAFE_PIECE` and `CAPTURE_THREAT` showed no reliable effect.

It is still not unbeatable: there is no opening book and no endgame knowledge.

---

## Features

- Local two-player mode and three AI difficulties
- Full keyboard play, with every square labelled for screen readers
- Four board themes (Classic Wood, Modern Glass, Marble, Neon) and four piece styles
- Synthesised sound effects via the Web Audio API, with volume control
- Move history, capture counters and king-promotion counters
- Optional match clock: five minutes each, losing on time, off by default. It stops while
  the tab is hidden, so switching away mid-turn costs nothing
- Automatic save to `localStorage` and resume from the main menu
- Move hints and mandatory-capture indicators, both toggleable
- Optional undo, off by default. Against the AI it takes back your move and the AI's
  reply, since undoing a single ply would just hand the turn straight back. Covers the
  current session only
- Lifetime statistics: games played, and wins and win rate against the AI. PvP games count
  as played but attribute no win, because both sides are played on the same device
- In-game rules reference

---

## Architecture

```
src/
├── components/
│   ├── Game.tsx              Game state, turn flow, AI orchestration
│   ├── Board.tsx             Board grid
│   ├── Square.tsx            One cell; owns the click for that cell
│   ├── Piece.tsx             Piece rendering
│   ├── GameInfo.tsx          Player cards, captures, clocks
│   ├── Controls.tsx          New game, undo, resign, quit
│   ├── MoveHistory.tsx       Recent moves
│   ├── MainMenu.tsx          Main menu with resume
│   ├── GameModeSelection.tsx Mode picker
│   ├── HowToPlay.tsx         Rules reference
│   ├── Settings.tsx          Settings page
│   ├── ToastNotification.tsx Notification system
│   ├── toastContext.ts       Toast context and hook
│   └── CheckerLogo.tsx       Brand mark
├── utils/
│   ├── rules.ts              The rules: move generation, capture paths, hashing
│   ├── aiEngine.ts           Search and evaluation
│   ├── aiWorker.ts           Worker entry point
│   ├── aiClient.ts           Worker client with in-process fallback
│   ├── gamePersistence.ts    Save and load
│   ├── gameSettings.ts       Settings
│   ├── gameStats.ts          Lifetime win/loss record
│   ├── boardNavigation.ts    Keyboard capture-cycling order
│   ├── labels.ts             Shared human-readable strings
│   ├── soundManager.ts       Web Audio sound effects
│   ├── audioEnvelope.ts      Gain envelope maths
│   └── visualThemes.ts       Board themes and piece styles
├── types/index.ts            Shared types
└── main.tsx                  Entry point
```

`rules.ts` is the single source of truth for how the game works. Both the board and the AI
import from it, so the search can never play by different rules than the UI enforces. It is
also free of React and DOM references, which is what allows the AI to run in a worker.

---

## Testing

```bash
npm test
```

49 tests across three files, covering the rules, the capture-path resolution shared by the
UI and the AI, and the AI's behaviour:

- Move generation, mandatory capture, flying kings, backward capture, promotion
- Capture chains of one to four jumps, forked chains, and the invariant that a piece is
  never captured twice in one sequence
- Step-by-step and direct-to-final-square capture producing identical boards
- Rejection of illegal shortcuts
- Win detection: an empty side, a blocked side, and the distinction between the player to
  move and the player who just moved
- Deeper search never scoring worse than shallower search against a fixed opponent
- Hard beating Easy, and Easy losing to Medium, over seeded matches

Tests seed or pin `Math.random`, so the AI's jitter cannot make them flaky.

---

## Tech stack

React 18, TypeScript (strict), Vite 5, Tailwind CSS, Vitest, ESLint, lucide-react,
Web Audio API, Web Workers, `localStorage`.

---

## Not yet implemented

- No live region announcing the opponent's move, so a screen reader hears that a move
  happened but not where.
- There is no opening book and no endgame database, so the AI plays the first and last
  few moves purely from search.

---

## License

MIT.
