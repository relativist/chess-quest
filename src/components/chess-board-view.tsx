"use client";

import Image from "next/image";
import { useSyncExternalStore } from "react";
import type { FenBoardSquare } from "@/lib/chess/fen-board";

type BoardTheme = "beige" | "green" | "gray";
type BoardOrientation = "black" | "white";

type ChessBoardViewProps = {
  ariaLabel: string;
  squares: FenBoardSquare[];
  className?: string;
  hintFromSquare?: string | null;
  hintToSquare?: string | null;
  legalMoveSquares?: string[];
  onSquareClick?: (square: FenBoardSquare) => void;
  orientation?: BoardOrientation;
  selectedSquare?: string | null;
};

const BOARD_THEME_STORAGE_KEY = "chess-quest-board-theme";
const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];

export function ChessBoardView({
  ariaLabel,
  squares,
  className,
  hintFromSquare = null,
  hintToSquare = null,
  legalMoveSquares = [],
  onSquareClick,
  orientation = "white",
  selectedSquare = null,
}: ChessBoardViewProps) {
  const theme = useSyncExternalStore(subscribeToBoardTheme, getBoardThemeSnapshot, getServerBoardThemeSnapshot);
  const orientedFiles = orientation === "black" ? files.slice().reverse() : files;
  const orientedRanks = orientation === "black" ? ranks.slice().reverse() : ranks;
  const orientedSquares = orientation === "black" ? squares.slice().reverse() : squares;

  function changeTheme(nextTheme: BoardTheme) {
    window.localStorage.setItem(BOARD_THEME_STORAGE_KEY, nextTheme);
    window.dispatchEvent(new Event("chess-quest-board-theme-change"));
  }

  return (
    <div className={`board-shell ${className ?? ""}`} data-board-theme={theme}>
      <div className="board-controls">
        <label>
          <span>Тема доски</span>
          <select value={theme} onChange={(event) => changeTheme(event.target.value as BoardTheme)}>
            <option value="beige">Бежевая</option>
            <option value="green">Зеленая</option>
            <option value="gray">Серая</option>
          </select>
        </label>
      </div>

      <div className="board-frame">
        <div className="board-corner" aria-hidden="true" />
        <div className="board-file-labels" aria-hidden="true">
          {orientedFiles.map((file) => <span key={`top-${file}`}>{file}</span>)}
        </div>
        <div className="board-corner" aria-hidden="true" />

        <div className="board-rank-labels" aria-hidden="true">
          {orientedRanks.map((rank) => <span key={`left-${rank}`}>{rank}</span>)}
        </div>
        <div className="board-placeholder chess-board" aria-label={ariaLabel}>
          {orientedSquares.map((square) => {
            const isSelected = square.square === selectedSquare;
            const isLegalMove = legalMoveSquares.includes(square.square);
            const isHintFrom = square.square === hintFromSquare;
            const isHintTo = square.square === hintToSquare;
            const className = `${square.color}${isSelected ? " selected" : ""}${isLegalMove ? " legal-move" : ""}${isHintFrom ? " engine-hint-from" : ""}${isHintTo ? " engine-hint-to" : ""}`;
            const content = square.piece ? (
              <Image height={128} src={square.piece.imageSrc} width={128} alt={square.piece.alt} loading="eager" />
            ) : null;

            if (onSquareClick) {
              return (
                <button
                  aria-label={square.piece ? `${square.square}: ${square.piece.alt}` : square.square}
                  className={className}
                  key={square.key}
                  type="button"
                  onClick={() => onSquareClick(square)}
                >
                  {content}
                </button>
              );
            }

            return <span className={className} key={square.key}>{content}</span>;
          })}
        </div>
        <div className="board-rank-labels" aria-hidden="true">
          {orientedRanks.map((rank) => <span key={`right-${rank}`}>{rank}</span>)}
        </div>

        <div className="board-corner" aria-hidden="true" />
        <div className="board-file-labels" aria-hidden="true">
          {orientedFiles.map((file) => <span key={`bottom-${file}`}>{file}</span>)}
        </div>
        <div className="board-corner" aria-hidden="true" />
      </div>
    </div>
  );
}

function subscribeToBoardTheme(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("chess-quest-board-theme-change", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("chess-quest-board-theme-change", onStoreChange);
  };
}

function getBoardThemeSnapshot(): BoardTheme {
  const savedTheme = window.localStorage.getItem(BOARD_THEME_STORAGE_KEY);
  return isBoardTheme(savedTheme) ? savedTheme : "beige";
}

function getServerBoardThemeSnapshot(): BoardTheme {
  return "beige";
}

function isBoardTheme(value: string | null): value is BoardTheme {
  return value === "beige" || value === "green" || value === "gray";
}
