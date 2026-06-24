import { publicPath } from "@/lib/routing/public-path";

export type FenBoardPiece = {
  code: string;
  imageSrc: string;
  alt: string;
};

export type FenBoardSquare = {
  key: string;
  square: string;
  piece: FenBoardPiece | null;
  color: "light" | "dark";
};

const PIECES: Record<string, FenBoardPiece> = {
  K: { code: "K", imageSrc: publicPath("/pieces/white-king.png"), alt: "Белый король" },
  Q: { code: "Q", imageSrc: publicPath("/pieces/white-queen.png"), alt: "Белый ферзь" },
  R: { code: "R", imageSrc: publicPath("/pieces/white-rook.png"), alt: "Белая ладья" },
  B: { code: "B", imageSrc: publicPath("/pieces/white-bishop.png"), alt: "Белый слон" },
  N: { code: "N", imageSrc: publicPath("/pieces/white-knight.png"), alt: "Белый конь" },
  P: { code: "P", imageSrc: publicPath("/pieces/white-pawn.png"), alt: "Белая пешка" },
  k: { code: "k", imageSrc: publicPath("/pieces/black-king.png"), alt: "Черный король" },
  q: { code: "q", imageSrc: publicPath("/pieces/black-queen.png"), alt: "Черный ферзь" },
  r: { code: "r", imageSrc: publicPath("/pieces/black-rook.png"), alt: "Черная ладья" },
  b: { code: "b", imageSrc: publicPath("/pieces/black-bishop.png"), alt: "Черный слон" },
  n: { code: "n", imageSrc: publicPath("/pieces/black-knight.png"), alt: "Черный конь" },
  p: { code: "p", imageSrc: publicPath("/pieces/black-pawn.png"), alt: "Черная пешка" },
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

export function fenToBoardSquares(fen: string): FenBoardSquare[] {
  const boardPart = fen.trim().split(/\s+/)[0] ?? "8/8/8/8/8/8/8/8";
  const rows = boardPart.split("/");
  const squares: FenBoardSquare[] = [];

  rows.forEach((row, rankIndex) => {
    let fileIndex = 0;
    const rank = 8 - rankIndex;

    for (const char of row) {
      if (/^[1-8]$/.test(char)) {
        for (let empty = 0; empty < Number(char); empty += 1) {
          squares.push(createSquare(fileIndex, rank, rankIndex, null));
          fileIndex += 1;
        }
        continue;
      }

      squares.push(createSquare(fileIndex, rank, rankIndex, PIECES[char] ?? null));
      fileIndex += 1;
    }
  });

  return squares;
}

function createSquare(
  fileIndex: number,
  rank: number,
  rankIndex: number,
  piece: FenBoardPiece | null,
): FenBoardSquare {
  const square = `${FILES[fileIndex] ?? "?"}${rank}`;

  return {
    key: square,
    square,
    piece,
    color: (rankIndex + fileIndex) % 2 === 0 ? "light" : "dark",
  };
}
