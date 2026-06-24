import type { PieceSymbol } from "chess.js";

export type MagicUpgradeId = "engine_hint" | "promote_pawn_bishop" | "promote_pawn_knight" | "promote_pawn_rook" | "promote_pawn_queen";

export type MagicUpgradeTarget =
  | "current_position"
  | "own_pawn";

export type MagicUpgradeSpec = {
  id: MagicUpgradeId;
  title: string;
  costGold: number;
  target: MagicUpgradeTarget;
  replacementPiece?: Extract<PieceSymbol, "b" | "n" | "r" | "q">;
  kingRule: string;
  consumesPlayerAction: boolean;
  afterUse: "engine_reply" | "player_keeps_turn";
  summary: string;
};

export const MAGIC_UPGRADES: MagicUpgradeSpec[] = [
  {
    id: "engine_hint",
    title: "Подсказка",
    costGold: 30,
    target: "current_position",
    kingRule: "Король не меняется и не может быть целью.",
    consumesPlayerAction: false,
    afterUse: "player_keeps_turn",
    summary: "Показывает лучший ход на доске без изменения позиции и без передачи хода движку.",
  },
  {
    id: "promote_pawn_bishop",
    title: "Слон",
    costGold: 100,
    target: "own_pawn",
    replacementPiece: "b",
    kingRule: "Король не меняется и не может быть целью.",
    consumesPlayerAction: true,
    afterUse: "engine_reply",
    summary: "Превращает выбранную пешку игрока в слона, затем ход переходит движку.",
  },
  {
    id: "promote_pawn_knight",
    title: "Конь",
    costGold: 120,
    target: "own_pawn",
    replacementPiece: "n",
    kingRule: "Король не меняется и не может быть целью.",
    consumesPlayerAction: true,
    afterUse: "engine_reply",
    summary: "Превращает выбранную пешку игрока в коня, затем ход переходит движку.",
  },
  {
    id: "promote_pawn_rook",
    title: "Ладья",
    costGold: 150,
    target: "own_pawn",
    replacementPiece: "r",
    kingRule: "Король не меняется и не может быть целью.",
    consumesPlayerAction: true,
    afterUse: "engine_reply",
    summary: "Превращает выбранную пешку игрока в ладью, затем ход переходит движку.",
  },
  {
    id: "promote_pawn_queen",
    title: "Ферзь",
    costGold: 220,
    target: "own_pawn",
    replacementPiece: "q",
    kingRule: "Король не меняется и не может быть целью.",
    consumesPlayerAction: true,
    afterUse: "engine_reply",
    summary: "Превращает выбранную пешку игрока в ферзя, затем ход переходит движку.",
  }
];

export function getMagicUpgradeById(id: string) {
  return MAGIC_UPGRADES.find((upgrade) => upgrade.id === id) ?? null;
}
