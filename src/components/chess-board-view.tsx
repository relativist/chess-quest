"use client";

import Image from "next/image";
import {useSyncExternalStore} from "react";
import type {FenBoardPiece, FenBoardSquare} from "@/lib/chess/fen-board";
import {publicPath} from "@/lib/routing/public-path";

type BoardTheme = "beige" | "blue" | "greenish" | "green" | "gray";
type PieceTheme =
  | "default"
  | "orc"
  | "super_hero"
  | "draf-tracula"
  | "magic_wood"
  | "magic_goblin"
  | "magic_bone"
  | "magic_focus"
  | "magic_iron"
  | "magic_jucy"
  | "chess.com";
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
const PIECE_THEME_STORAGE_KEY = "chess-quest-piece-theme";
const PIECE_THEME_OPTIONS: { label: string; value: PieceTheme }[] = [
  { label: "Lichess.org", value: "default" },
  { label: "Chess.com", value: "chess.com" },
  { label: "Орки", value: "orc" },
  { label: "Супергерои", value: "super_hero" },
  { label: "Драф-тракула", value: "draf-tracula" },
  { label: "Магический лес", value: "magic_wood" },
  { label: "Магический гоблин", value: "magic_goblin" },
  { label: "Магическая кость", value: "magic_bone" },
  { label: "Магический фокус", value: "magic_focus" },
  { label: "Магическое железо", value: "magic_iron" },
  { label: "Магический сок", value: "magic_jucy" },
];
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
  const boardTheme = useSyncExternalStore(subscribeToBoardTheme, getBoardThemeSnapshot, getServerBoardThemeSnapshot);
  const pieceTheme = useSyncExternalStore(subscribeToPieceTheme, getPieceThemeSnapshot, getServerPieceThemeSnapshot);
  const orientedFiles = orientation === "black" ? files.slice().reverse() : files;
  const orientedRanks = orientation === "black" ? ranks.slice().reverse() : ranks;
  const orientedSquares = orientation === "black" ? squares.slice().reverse() : squares;

  function changeBoardTheme(nextTheme: BoardTheme) {
    window.localStorage.setItem(BOARD_THEME_STORAGE_KEY, nextTheme);
    window.dispatchEvent(new Event("chess-quest-board-theme-change"));
  }

  function changePieceTheme(nextTheme: PieceTheme) {
    window.localStorage.setItem(PIECE_THEME_STORAGE_KEY, nextTheme);
    window.dispatchEvent(new Event("chess-quest-piece-theme-change"));
  }

  return (
    <div className={`board-shell ${className ?? ""}`} data-board-theme={boardTheme}>
      <div className="board-controls">
        <label>
          <span className="board-control-icon-label" title="Доска">
            <Image className="board-control-icon" src={publicPath("/assets/images/icons/chess-board.png")} alt="Доска" width={30} height={30} />
          </span>
          <select aria-label="Доска" value={boardTheme} onChange={(event) => changeBoardTheme(event.target.value as BoardTheme)}>
            <option value="beige">Коричневая</option>
            <option value="greenish">Зеленоватая</option>
            <option value="blue">Голубая</option>
            <option value="green">Зеленая</option>
            <option value="gray">Серая</option>
          </select>
        </label>
        <label>
          <span className="board-control-icon-label" title="Фигуры">
            <Image className="board-control-icon" src={publicPath("/assets/images/icons/pawn.png")} alt="Фигуры" width={30} height={30} />
          </span>
          <select aria-label="Фигуры" value={pieceTheme} onChange={(event) => changePieceTheme(event.target.value as PieceTheme)}>
            {PIECE_THEME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
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
        <div className="board-placeholder chess-board" role="group" aria-label={ariaLabel}>
          {orientedSquares.map((square) => {
            const isSelected = square.square === selectedSquare;
            const isLegalMove = legalMoveSquares.includes(square.square);
            const isHintFrom = square.square === hintFromSquare;
            const isHintTo = square.square === hintToSquare;
            const className = `${square.color}${isSelected ? " selected" : ""}${isLegalMove ? " legal-move" : ""}${isHintFrom ? " engine-hint-from" : ""}${isHintTo ? " engine-hint-to" : ""}`;
            const content = square.piece ? (
              <Image height={128} src={getPieceImageSrc(square.piece, pieceTheme)} width={128} alt={square.piece.alt} loading="eager" />
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


function subscribeToPieceTheme(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("chess-quest-piece-theme-change", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("chess-quest-piece-theme-change", onStoreChange);
  };
}

function getPieceThemeSnapshot(): PieceTheme {
  const savedTheme = window.localStorage.getItem(PIECE_THEME_STORAGE_KEY);
  if (savedTheme === "cha-cha-boom") return "chess.com";
  return isPieceTheme(savedTheme) ? savedTheme : "default";
}

function getServerPieceThemeSnapshot(): PieceTheme {
  return "default";
}

function isPieceTheme(value: string | null): value is PieceTheme {
  return PIECE_THEME_OPTIONS.some((option) => option.value === value);
}

function getPieceImageSrc(piece: FenBoardPiece, theme: PieceTheme) {
  const color = piece.code === piece.code.toUpperCase() ? "white" : "black";
  const pieceName = getPieceName(piece.code);
  return publicPath(`/assets/images/pieces/${theme}/${color}-${pieceName}.png`);
}

function getPieceName(code: string) {
  switch (code.toLowerCase()) {
    case "k":
      return "king";
    case "q":
      return "queen";
    case "r":
      return "rook";
    case "b":
      return "bishop";
    case "n":
      return "knight";
    default:
      return "pawn";
  }
}

function getBoardThemeSnapshot(): BoardTheme {
  const savedTheme = window.localStorage.getItem(BOARD_THEME_STORAGE_KEY);
  return isBoardTheme(savedTheme) ? savedTheme : "beige";
}

function getServerBoardThemeSnapshot(): BoardTheme {
  return "beige";
}

function isBoardTheme(value: string | null): value is BoardTheme {
  return value === "beige" || value === "blue" || value === "greenish" || value === "green" || value === "gray";
}
