export type FenBoardPiece = {
  code: string;
  alt: string;
};

export type FenBoardSquare = {
  key: string;
  square: string;
  piece: FenBoardPiece | null;
  color: "light" | "dark";
};

const PIECES: Record<string, FenBoardPiece> = {
  K: { code: "K", alt: "Белый король" },
  Q: { code: "Q", alt: "Белый ферзь" },
  R: { code: "R", alt: "Белая ладья" },
  B: { code: "B", alt: "Белый слон" },
  N: { code: "N", alt: "Белый конь" },
  P: { code: "P", alt: "Белая пешка" },
  k: { code: "k", alt: "Черный король" },
  q: { code: "q", alt: "Черный ферзь" },
  r: { code: "r", alt: "Черная ладья" },
  b: { code: "b", alt: "Черный слон" },
  n: { code: "n", alt: "Черный конь" },
  p: { code: "p", alt: "Черная пешка" },
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
