import { Chess, validateFen as validateChessFen, type Color, type Square } from "chess.js";

export const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type SideToMove = "white" | "black";

export type FenValidationIssue = {
  code: string;
  message: string;
};

export type FenValidationResult = {
  ok: boolean;
  fen: string;
  sideToMove?: SideToMove;
  issues: FenValidationIssue[];
};

type PieceColor = "white" | "black";

type LocatedPiece = {
  piece: string;
  color: PieceColor;
  file: number;
  rank: number;
  square: Square;
};

type ParsedBoard = {
  pieces: LocatedPiece[];
  issues: FenValidationIssue[];
};

const VALID_PIECES = new Set(["p", "n", "b", "r", "q", "k"]);
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

export function validateBoardTemplateFen(fen: string, maxPiecesPerColor = 24): FenValidationResult {
  const normalizedFen = fen.trim().replace(/\s+/g, " ");
  const issues: FenValidationIssue[] = [];

  if (!normalizedFen) {
    return {
      ok: false,
      fen: normalizedFen,
      issues: [{ code: "fen.empty", message: "FEN не может быть пустым." }],
    };
  }

  const fields = normalizedFen.split(" ");
  if (fields.length !== 6) {
    issues.push({ code: "fen.fields", message: "FEN должен состоять из 6 полей." });
  }

  const [boardPart, turnPart] = fields;
  const parsedBoard = parseFenBoard(boardPart ?? "");
  issues.push(...parsedBoard.issues);

  const chessFenResult = validateChessFen(normalizedFen);
  if (!chessFenResult.ok) {
    issues.push({
      code: "fen.chessjs",
      message: chessFenResult.error ?? "Позиция не проходит проверку chess.js.",
    });
  }

  const whitePieces = parsedBoard.pieces.filter((piece) => piece.color === "white");
  const blackPieces = parsedBoard.pieces.filter((piece) => piece.color === "black");
  const whiteKings = whitePieces.filter((piece) => piece.piece.toLowerCase() === "k");
  const blackKings = blackPieces.filter((piece) => piece.piece.toLowerCase() === "k");

  if (whiteKings.length !== 1) {
    issues.push({ code: "king.white", message: "На доске должен быть ровно один белый король." });
  }

  if (blackKings.length !== 1) {
    issues.push({ code: "king.black", message: "На доске должен быть ровно один черный король." });
  }

  if (whitePieces.length > maxPiecesPerColor) {
    issues.push({
      code: "pieces.white.limit",
      message: `У белых не может быть больше ${maxPiecesPerColor} фигур.`,
    });
  }

  if (blackPieces.length > maxPiecesPerColor) {
    issues.push({
      code: "pieces.black.limit",
      message: `У черных не может быть больше ${maxPiecesPerColor} фигур.`,
    });
  }

  for (const pawn of parsedBoard.pieces.filter((piece) => piece.piece.toLowerCase() === "p")) {
    if (pawn.rank === 1 || pawn.rank === 8) {
      issues.push({
        code: "pawn.edge-rank",
        message: "Пешки не могут стоять на первой или восьмой горизонтали.",
      });
      break;
    }
  }

  if (whiteKings.length === 1 && blackKings.length === 1 && areKingsAdjacent(whiteKings[0], blackKings[0])) {
    issues.push({ code: "king.adjacent", message: "Короли не могут стоять рядом." });
  }

  if (chessFenResult.ok && whiteKings.length === 1 && blackKings.length === 1) {
    const chess = new Chess(normalizedFen);
    const whiteKingInCheck = chess.isAttacked(whiteKings[0].square, "b" as Color);
    const blackKingInCheck = chess.isAttacked(blackKings[0].square, "w" as Color);

    if (whiteKingInCheck && blackKingInCheck) {
      issues.push({ code: "king.both-in-check", message: "Оба короля не могут одновременно находиться под шахом." });
    }
  }

  return {
    ok: issues.length === 0,
    fen: normalizedFen,
    sideToMove: parseSideToMove(turnPart),
    issues: dedupeIssues(issues),
  };
}

export function getFenSideToMove(fen: string): SideToMove | undefined {
  return parseSideToMove(fen.trim().split(/\s+/)[1]);
}

function parseFenBoard(boardPart: string): ParsedBoard {
  const pieces: LocatedPiece[] = [];
  const issues: FenValidationIssue[] = [];
  const rows = boardPart.split("/");

  if (rows.length !== 8) {
    issues.push({ code: "board.ranks", message: "В FEN должно быть 8 горизонталей доски." });
  }

  rows.slice(0, 8).forEach((row, rowIndex) => {
    let file = 0;
    const rank = 8 - rowIndex;

    for (const char of row) {
      if (/^[1-8]$/.test(char)) {
        file += Number(char);
        continue;
      }

      if (!VALID_PIECES.has(char.toLowerCase())) {
        issues.push({ code: "board.piece", message: `Недопустимый символ фигуры в FEN: ${char}.` });
        continue;
      }

      if (file > 7) {
        issues.push({ code: "board.file-overflow", message: "В горизонтали FEN больше 8 клеток." });
        continue;
      }

      pieces.push({
        piece: char,
        color: char === char.toUpperCase() ? "white" : "black",
        file,
        rank,
        square: `${FILES[file]}${rank}` as Square,
      });
      file += 1;
    }

    if (file !== 8) {
      issues.push({ code: "board.rank-width", message: "Каждая горизонталь FEN должна содержать ровно 8 клеток." });
    }
  });

  return { pieces, issues };
}

function parseSideToMove(turnPart: string | undefined): SideToMove | undefined {
  if (turnPart === "w") return "white";
  if (turnPart === "b") return "black";
  return undefined;
}

function areKingsAdjacent(whiteKing: LocatedPiece, blackKing: LocatedPiece) {
  return Math.abs(whiteKing.file - blackKing.file) <= 1 && Math.abs(whiteKing.rank - blackKing.rank) <= 1;
}

function dedupeIssues(issues: FenValidationIssue[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
