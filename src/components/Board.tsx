import { useRef, useState, useEffect, useCallback } from 'react';
import { Piece as PieceType, Position } from '../types';
import Square from './Square';
import { getGameSettings } from '../utils/gameSettings';
import { getBoardTheme, getPieceStyle, getBoardFrameClasses, getBoardGridClasses } from '../utils/visualThemes';

interface BoardProps {
  board: (PieceType | null)[][];
  selectedPiece: PieceType | null;
  validMoves: Position[];
  onSquareClick: (position: Position) => void;
  onPieceClick: (piece: PieceType) => void;
  shakingPieceId: string | null;
  piecesWithCaptures: Set<string>;
  /** Escape clears the current selection. */
  onDeselect: () => void;
}

/** Where the keyboard cursor starts: the first playable square. */
const INITIAL_CURSOR: Position = { row: 0, col: 1 };

const Board = ({ board, selectedPiece, validMoves, onSquareClick, onPieceClick, shakingPieceId, piecesWithCaptures, onDeselect }: BoardProps) => {
  // Read once for the whole board. Square and Piece used to call this
  // themselves, which meant a synchronous localStorage read and JSON.parse per
  // square and per piece — 64+ of them on every repaint.
  const gameSettings = getGameSettings();
  const boardTheme = getBoardTheme(gameSettings);
  const pieceStyle = getPieceStyle(gameSettings);

  // Roving tabindex: the board is a single tab stop, and the arrow keys move a
  // cursor within it. Previously the board was 64 plain divs with click
  // handlers, so it could not be reached or played from a keyboard at all.
  const [cursor, setCursor] = useState<Position>(INITIAL_CURSOR);
  const cellRefs = useRef(new Map<string, HTMLDivElement>());
  const gridRef = useRef<HTMLDivElement>(null);

  const registerCell = useCallback((row: number, col: number, el: HTMLDivElement | null) => {
    const key = `${row}-${col}`;
    if (el) cellRefs.current.set(key, el);
    else cellRefs.current.delete(key);
  }, []);

  // Move focus to the cursor square, but only while the board already has focus,
  // so mounting the board never steals focus from elsewhere on the page.
  useEffect(() => {
    const cell = cellRefs.current.get(`${cursor.row}-${cursor.col}`);
    if (!cell || cell === document.activeElement) return;

    const focusIsInBoard = gridRef.current?.contains(document.activeElement);
    if (focusIsInBoard) cell.focus();
  }, [cursor]);

  const moveCursor = (rowDelta: number, colDelta: number) => {
    // One square at a time, including the light squares.
    //
    // Skipping straight to the next dark square looks tidier but breaks
    // reachability: playable columns alternate parity by row, so holding the
    // column fixed and stepping two rows can only ever visit half the playable
    // squares. Visiting every cell keeps the whole board reachable, and light
    // squares announce themselves as unplayable.
    //
    // Focusing happens in the effect above rather than here: doing it inside a
    // setState updater is a side effect in a function React may call more than
    // once, and it left the cursor stuck after a single step.
    setCursor(prev => ({
      row: Math.min(7, Math.max(0, prev.row + rowDelta)),
      col: Math.min(7, Math.max(0, prev.col + colDelta)),
    }));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowUp': event.preventDefault(); moveCursor(-1, 0); break;
      case 'ArrowDown': event.preventDefault(); moveCursor(1, 0); break;
      case 'ArrowLeft': event.preventDefault(); moveCursor(0, -1); break;
      case 'ArrowRight': event.preventDefault(); moveCursor(0, 1); break;
      case 'Escape': event.preventDefault(); onDeselect(); break;
      default: break;
    }
  };

  const isValidMove = (row: number, col: number): boolean => {
    return validMoves.some(move => move.row === row && move.col === col);
  };

  const isSelected = (piece: PieceType | null): boolean => {
    return piece !== null && selectedPiece !== null && piece.id === selectedPiece.id;
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className={getBoardFrameClasses(boardTheme)}>
        <div
          ref={gridRef}
          role="grid"
          aria-label="Checkers board. Use the arrow keys to move between squares, then Enter to select a piece or play a move. Escape clears the selection."
          aria-rowcount={8}
          aria-colcount={8}
          onKeyDown={handleKeyDown}
          className={getBoardGridClasses(boardTheme)}
        >
          {board.map((row, rowIndex) =>
            row.map((piece, colIndex) => {
              const isLight = (rowIndex + colIndex) % 2 === 0;
              const isCursor = cursor.row === rowIndex && cursor.col === colIndex;
              return (
                <Square
                  key={`${rowIndex}-${colIndex}`}
                  position={{ row: rowIndex, col: colIndex }}
                  piece={piece}
                  isLight={isLight}
                  isValidMove={isValidMove(rowIndex, colIndex)}
                  isSelected={isSelected(piece)}
                  onSquareClick={onSquareClick}
                  onPieceClick={onPieceClick}
                  isShaking={piece !== null && piece.id === shakingPieceId}
                  hasCapture={piece !== null && piecesWithCaptures.has(piece.id)}
                  boardTheme={boardTheme}
                  pieceStyle={pieceStyle}
                  animationsEnabled={gameSettings.animationsEnabled}
                  showMoveHints={gameSettings.showMoveHints}
                  isCursor={isCursor}
                  onFocusCell={setCursor}
                  registerCell={registerCell}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Board;
