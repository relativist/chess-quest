"use client";

import {Chess} from "chess.js";
import Image from "next/image";
import {useEffect, useMemo, useState} from "react";
import {useRouter} from "next/navigation";
import {saveMapEditorAction} from "@/app/map/editor/actions";
import {ChessBoardView} from "@/components/chess-board-view";
import {RightSideToast} from "@/components/right-side-toast";
import {fenToBoardSquares} from "@/lib/chess/fen-board";
import {STARTING_FEN, validateBoardTemplateFen} from "@/lib/chess/fen-validation";
import type {DemoQuestCardSeed} from "@/lib/demo-seed";
import {type CardObjective} from "@/lib/quest/card-objectives";
import type {MapEditorCardInput} from "@/lib/quest/quest-repository";
import {publicPath} from "@/lib/routing/public-path";

type CardFenEditorProps = {
  cards: Array<DemoQuestCardSeed & { initialFen: string }>;
  mapDescription: string;
  mapIsPublished: boolean;
  mapSlug: string;
  mapTitle: string;
};

type EditorCardDraft = MapEditorCardInput;

type EditorNotification = {
  id: number;
  iconAlt?: string;
  iconSrc?: string;
  text: string;
  tone: "error" | "success";
};

type FenMoveCheck = {
  text: string;
  tone: "error" | "success";
};

type EditorTab = "map" | "card";
type FenEditorTool = "erase" | "K" | "Q" | "R" | "B" | "N" | "P" | "k" | "q" | "r" | "b" | "n" | "p";

const FEN_EDITOR_TOOLS: Array<{ alt: string; code: FenEditorTool; imageSrc?: string; label: string }> = [
  { alt: "Убрать фигуру", code: "erase", label: "×" },
  { alt: "Белый король", code: "K", imageSrc: publicPath("/assets/images/pieces/default/white-king.png"), label: "♔" },
  { alt: "Белый ферзь", code: "Q", imageSrc: publicPath("/assets/images/pieces/default/white-queen.png"), label: "♕" },
  { alt: "Белая ладья", code: "R", imageSrc: publicPath("/assets/images/pieces/default/white-rook.png"), label: "♖" },
  { alt: "Белый слон", code: "B", imageSrc: publicPath("/assets/images/pieces/default/white-bishop.png"), label: "♗" },
  { alt: "Белый конь", code: "N", imageSrc: publicPath("/assets/images/pieces/default/white-knight.png"), label: "♘" },
  { alt: "Белая пешка", code: "P", imageSrc: publicPath("/assets/images/pieces/default/white-pawn.png"), label: "♙" },
  { alt: "Черный король", code: "k", imageSrc: publicPath("/assets/images/pieces/default/black-king.png"), label: "♚" },
  { alt: "Черный ферзь", code: "q", imageSrc: publicPath("/assets/images/pieces/default/black-queen.png"), label: "♛" },
  { alt: "Черная ладья", code: "r", imageSrc: publicPath("/assets/images/pieces/default/black-rook.png"), label: "♜" },
  { alt: "Черный слон", code: "b", imageSrc: publicPath("/assets/images/pieces/default/black-bishop.png"), label: "♝" },
  { alt: "Черный конь", code: "n", imageSrc: publicPath("/assets/images/pieces/default/black-knight.png"), label: "♞" },
  { alt: "Черная пешка", code: "p", imageSrc: publicPath("/assets/images/pieces/default/black-pawn.png"), label: "♟" },
];
const RENEW_ICON_SRC = publicPath("/assets/images/icons/renew.png");
const SAVE_ICON_SRC = publicPath("/assets/images/icons/save.png");
const TEST_ICON_SRC = publicPath("/assets/images/icons/test.png");

export function CardFenEditor({ cards, mapDescription, mapIsPublished, mapSlug, mapTitle }: CardFenEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(mapTitle);
  const [description, setDescription] = useState(mapDescription);
  const [isPublished, setIsPublished] = useState(mapIsPublished);
  const [editorCards, setEditorCards] = useState<EditorCardDraft[]>(() => createInitialDrafts(cards));
  const [selectedSlug, setSelectedSlug] = useState(() => cards[0]?.slug ?? "");
  const [activeTab, setActiveTab] = useState<EditorTab>("map");
  const [fenEditorTool, setFenEditorTool] = useState<FenEditorTool>("erase");
  const [fenMoveCheck, setFenMoveCheck] = useState<FenMoveCheck | null>(null);
  const [fenMoveBack, setFenMoveBack] = useState<string | null>(null);
  const [notification, setNotification] = useState<EditorNotification | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingFenMove, setIsTestingFenMove] = useState(false);
  const selectedCard = editorCards.find((card) => card.slug === selectedSlug) ?? editorCards[0];

  const draftFen = selectedCard?.fen ?? "";
  const effectiveFen = draftFen.trim() || STARTING_FEN;
  const validation = useMemo(() => {
    if (!draftFen.trim()) {
      return { ok: true, fen: STARTING_FEN, sideToMove: "white" as const, issues: [] };
    }

    return validateBoardTemplateFen(draftFen);
  }, [draftFen]);
  const previewSquares = useMemo(() => fenToBoardSquares(validation.ok ? effectiveFen : STARTING_FEN), [effectiveFen, validation.ok]);
  const isWhiteToMove = validation.sideToMove !== "black";

  useEffect(() => {
    if (!notification) return;

    const timeoutId = window.setTimeout(() => setNotification(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [notification]);

  function updateSelectedDraft(nextDraft: Partial<Pick<EditorCardDraft, "congratulationsText" | "difficulty" | "fen" | "objective" | "rewardGold" | "rewardScore" | "text" | "title">>) {
    if (!selectedCard) return;
    setNotification(null);
    setFenMoveCheck(null);
    setFenMoveBack(null);
    setEditorCards((current) => current.map((card) => (card.slug === selectedCard.slug ? { ...card, ...nextDraft } : card)));
  }

  function updateSelectedFen(nextFen: string) {
    updateSelectedDraft({ fen: nextFen === STARTING_FEN ? "" : nextFen });
  }

  function updateFenSquare(square: string) {
    if (!selectedCard || !validation.ok) return;

    updateSelectedFen(setFenBoardSquare(effectiveFen, square, fenEditorTool === "erase" ? null : fenEditorTool));
  }

  function updateFenSideToMove(isWhite: boolean) {
    if (!selectedCard || !validation.ok) return;

    updateSelectedFen(setFenSideToMove(effectiveFen, isWhite ? "w" : "b"));
  }

  async function makeTestComputerMove() {
    if (!selectedCard) return;

    if (!validation.ok) {
      setFenMoveCheck({ text: validation.issues[0]?.message ?? "Исправьте FEN перед проверкой хода.", tone: "error" });
      return;
    }

    try {
      const chess = new Chess(validation.fen);
      const moves = chess.moves({ verbose: true });
      if (moves.length === 0) {
        const reason = chess.isCheckmate() ? "мат" : chess.isStalemate() ? "пат" : "нет легальных ходов";
        setFenMoveCheck({ text: "Компьютер не может сделать ход: " + reason + ".", tone: "error" });
        return;
      }

      setIsTestingFenMove(true);
      setFenMoveCheck({ text: "Stockfish проверяет позицию...", tone: "success" });
      const bestMove = await requestStockfishBestMove(validation.fen, publicPath("/stockfish/stockfish-18-lite-single.js"));
      if (isNoEngineMove(bestMove)) {
        setFenMoveCheck({ text: "Stockfish не вернул ход для этой позиции. Упростите FEN или уменьшите количество фигур.", tone: "error" });
        return;
      }

      const previousFen = validation.fen;
      const move = chess.move(uciToMove(bestMove));
      if (!move) {
        setFenMoveCheck({ text: "Stockfish вернул нелегальный ход: " + formatUciMove(bestMove) + ".", tone: "error" });
        return;
      }

      updateSelectedFen(chess.fen());
      setFenMoveBack(fenMoveBack ?? previousFen);
      setFenMoveCheck({ text: "Stockfish сделал тестовый ход: " + move.san + ".", tone: "success" });
    } catch (error) {
      setFenMoveCheck({ text: error instanceof Error ? error.message : "Позиция не подходит для хода.", tone: "error" });
    } finally {
      setIsTestingFenMove(false);
    }
  }

  function rollbackTestComputerMove() {
    if (!fenMoveBack) return;

    updateSelectedFen(fenMoveBack);
    setFenMoveBack(null);
    setFenMoveCheck({ text: "Позиция возвращена к состоянию до теста.", tone: "success" });
  }

  function addCard() {
    setNotification(null);
    const newSlug = "card-" + Date.now();
    const nextOrder = Math.max(0, ...editorCards.map((card) => card.order)) + 1;
    const newCard: EditorCardDraft = {
      slug: newSlug,
      order: nextOrder,
      title: "Новая карточка " + nextOrder,
      text: "Описание новой битвы.",
      congratulationsText: "Победа засчитана. Забирай награду и возвращайся на карту.",
      fen: "",
      rewardGold: 100,
      rewardScore: 100,
      difficulty: 0,
      objective: { type: "checkmate" },
    };

    setEditorCards((current) => [...current, newCard]);
    setSelectedSlug(newSlug);
    setActiveTab("card");
  }

  function showNotification(text: string, tone: EditorNotification["tone"], icon?: Pick<EditorNotification, "iconAlt" | "iconSrc">) {
    setNotification({ id: Date.now(), iconAlt: icon?.iconAlt, iconSrc: icon?.iconSrc, text, tone });
  }

  async function saveMap() {
    const validationError = getDraftValidationError(editorCards);
    if (validationError) {
      showNotification(validationError, "error");
      return;
    }

    setIsSaving(true);
    const result = await saveMapEditorAction({
      slug: mapSlug,
      title,
      description,
      isPublished,
      cards: editorCards,
    });
    setIsSaving(false);

    if (!result.ok) {
      showNotification(result.error, "error");
      return;
    }

    showNotification("Сохранено.", "success", { iconAlt: "Сохранить", iconSrc: SAVE_ICON_SRC });
    router.refresh();
  }

  const mapTabContent = (
    <>
      <MapFields
        description={description}
        isPublished={isPublished}
        title={title}
        onDescriptionChange={setDescription}
        onPublishedChange={setIsPublished}
        onTitleChange={setTitle}
      />
      {!selectedCard ? <div className="position-note">На этой карте пока нет карточек. Добавьте первую карточку слева.</div> : null}
      <div className="editor-actions">
        <button className="save-map-button" type="button" disabled={isSaving} onClick={saveMap}>
          <Image className="save-map-button-icon" src={SAVE_ICON_SRC} alt="" width={56} height={56} />
          <span>{isSaving ? "Сохранение..." : "Сохранить карту"}</span>
        </button>
      </div>
    </>
  );

  const cardTabContent = selectedCard ? (
    <>
      <div className="editor-heading">
        <div>
          <p className="eyebrow">Карточка {selectedCard.order}</p>
          <h2>{selectedCard.title}</h2>
        </div>
      </div>

      <div className="editor-form-grid">
        <label>
          Название карточки
          <input type="text" value={selectedCard.title} onChange={(event) => updateSelectedDraft({ title: event.target.value })} />
        </label>
        <label>
          Текст карточки
          <textarea rows={3} value={selectedCard.text} onChange={(event) => updateSelectedDraft({ text: event.target.value })} />
        </label>
        <label>
          Поздравление после победы
          <textarea rows={3} value={selectedCard.congratulationsText} onChange={(event) => updateSelectedDraft({ congratulationsText: event.target.value })} />
        </label>
        <div className="objective-editor-row">
          <label>
            Цель карточки
            <select
              value={toEditorObjectiveType(selectedCard.objective)}
              onChange={(event) => updateSelectedDraft({ objective: createObjectiveByType(event.target.value, selectedCard.objective) })}
            >
              <option value="checkmate">Поставить мат</option>
              <option value="checkmate_in_moves">Поставить мат за N ходов</option>
              <option value="give_check">Поставить шах</option>
              <option value="give_checks">Поставить N шахов королю</option>
              <option value="survive_half_moves">Продержаться N полуходов</option>
              <option value="capture_pieces">Съесть N фигур противника</option>
            </select>
          </label>
          {selectedCard.objective.type === "checkmate_in_moves" ? (
            <label>
              Ходов
              <input
                min={1}
                max={99}
                type="number"
                value={selectedCard.objective.moves}
                onChange={(event) => updateSelectedDraft({ objective: { moves: Number(event.target.value), type: "checkmate_in_moves" } })}
              />
            </label>
          ) : null}
          {selectedCard.objective.type === "give_checks" ? (
            <label>
              Шахов
              <input
                min={1}
                max={99}
                type="number"
                value={selectedCard.objective.checks}
                onChange={(event) => updateSelectedDraft({ objective: { checks: Number(event.target.value), type: "give_checks" } })}
              />
            </label>
          ) : null}
          {selectedCard.objective.type === "survive_half_moves" ? (
            <label>
              Полуходов
              <input
                min={1}
                max={99}
                type="number"
                value={selectedCard.objective.halfMoves}
                onChange={(event) => updateSelectedDraft({ objective: { halfMoves: Number(event.target.value), type: "survive_half_moves" } })}
              />
            </label>
          ) : null}
          {selectedCard.objective.type === "capture_pieces" || selectedCard.objective.type === "capture_piece" ? (
            <label>
              Фигур
              <input
                min={1}
                max={99}
                type="number"
                value={selectedCard.objective.type === "capture_pieces" ? selectedCard.objective.pieces : 1}
                onChange={(event) => updateSelectedDraft({ objective: { pieces: Number(event.target.value), type: "capture_pieces" } })}
              />
            </label>
          ) : null}
        </div>
        <label>
          Сложность движка
          <input
            max={8}
            min={0}
            type="number"
            value={selectedCard.difficulty}
            onChange={(event) => updateSelectedDraft({ difficulty: Number(event.target.value) as EditorCardDraft["difficulty"] })}
          />
        </label>
        <label>
          Очки за победу
          <input min={1} type="number" value={selectedCard.rewardScore} onChange={(event) => updateSelectedDraft({ rewardScore: Number(event.target.value) })} />
        </label>
        <label>
          Золото за победу
          <input min={1} type="number" value={selectedCard.rewardGold} onChange={(event) => updateSelectedDraft({ rewardGold: Number(event.target.value) })} />
        </label>
        <label className="checkbox-field fen-side-toggle">
          <input checked={isWhiteToMove} disabled={!validation.ok} type="checkbox" onChange={(event) => updateFenSideToMove(event.target.checked)} />
          Первый ход: {isWhiteToMove ? "белые" : "черные"}
        </label>
        <div className={validation.ok ? "validation-pill ok" : "validation-pill error"}>
          {validation.ok ? "FEN валиден" : "FEN с ошибками"}
        </div>
        <label className="fen-text-field">
          FEN позиции
          <textarea
            rows={4}
            spellCheck={false}
            value={draftFen}
            placeholder={STARTING_FEN}
            onChange={(event) => updateSelectedDraft({ fen: event.target.value })}
          />
        </label>
      </div>

      <div className="fen-board-editor">
        <div className="fen-board-area">
          <ChessBoardView
            ariaLabel="Редактор FEN"
            className="editor-board"
            squares={previewSquares}
            onSquareClick={(square) => updateFenSquare(square.square)}
          />
          <label className="fen-readonly-field">
            FEN
            <input readOnly value={validation.ok ? validation.fen : ""} placeholder="Исправьте FEN позиции" />
          </label>
          {fenMoveCheck ? <p className={`fen-test-result ${fenMoveCheck.tone}`}>{fenMoveCheck.text}</p> : null}
          {!validation.ok ? (
            <div className="fen-errors" role="alert">
              {validation.issues.map((issue) => (
                <p key={issue.code + ":" + issue.message}>{issue.message}</p>
              ))}
            </div>
          ) : null}
        </div>

        <div className="fen-piece-palette" aria-label="Фигуры для добавления на доску">
          {FEN_EDITOR_TOOLS.map((tool) => (
            <button
              aria-label={tool.alt}
              aria-pressed={fenEditorTool === tool.code}
              className={fenEditorTool === tool.code ? "active" : ""}
              key={tool.code}
              title={tool.alt}
              type="button"
              onClick={() => setFenEditorTool(tool.code)}
            >
              {tool.imageSrc ? (
                <Image className="fen-piece-tool-image" src={tool.imageSrc} alt="" width={56} height={56} />
              ) : (
                <span className="fen-erase-symbol">{tool.label}</span>
              )}
            </button>
          ))}
          <button
            aria-label={isTestingFenMove ? "Проверка тестового хода" : "Тестовый ход"}
            className="fen-test-move-button"
            disabled={isTestingFenMove}
            title="Тестовый ход"
            type="button"
            onClick={makeTestComputerMove}
          >
            <Image className="fen-palette-action-icon" src={TEST_ICON_SRC} alt="" width={56} height={56} />
          </button>
          <button
            aria-label="Вернуть позицию к началу теста"
            className="fen-test-back-button"
            disabled={!fenMoveBack || isTestingFenMove}
            title="Сначала"
            type="button"
            onClick={rollbackTestComputerMove}
          >
            <Image className="fen-palette-action-icon" src={RENEW_ICON_SRC} alt="" width={56} height={56} />
          </button>
        </div>
      </div>

      <div className="editor-actions">
        <button className="save-map-button" type="button" disabled={!validation.ok || isSaving} onClick={saveMap}>
          <Image className="save-map-button-icon" src={SAVE_ICON_SRC} alt="" width={56} height={56} />
          <span>{isSaving ? "Сохранение..." : "Сохранить карту"}</span>
        </button>
      </div>
    </>
  ) : (
    <div className="position-note">На этой карте пока нет карточек. Добавьте первую карточку слева.</div>
  );

  return (
    <>
      {notification ? (
        <RightSideToast
          key={notification.id}
          iconAlt={notification.iconAlt}
          iconSrc={notification.iconSrc}
          message={notification.text}
          tone={notification.tone}
        />
      ) : null}
      <div className="editor-layout">
        <aside className="editor-card-list" aria-label="Карточки карты">
          <button className="add-card-button" type="button" onClick={addCard}>+ Добавить карточку</button>
          {editorCards.map((card) => (
            <button
              className={card.slug === selectedSlug ? "selected" : ""}
              key={card.slug}
              type="button"
              onClick={() => {
                setSelectedSlug(card.slug);
                setActiveTab("card");
              }}
            >
              <span>{card.order}</span>
              <strong>{card.title}</strong>
            </button>
          ))}
        </aside>

        <section className="editor-panel" aria-label="Редактирование карты">
          <EditorTabs activeTab={activeTab} hasSelectedCard={Boolean(selectedCard)} onTabChange={setActiveTab} />
          <div className="editor-tab-panel" role="tabpanel">
            {activeTab === "map" ? mapTabContent : cardTabContent}
          </div>
        </section>
      </div>
    </>
  );
}

type EditorTabsProps = {
  activeTab: EditorTab;
  hasSelectedCard: boolean;
  onTabChange: (tab: EditorTab) => void;
};

function EditorTabs({ activeTab, hasSelectedCard, onTabChange }: EditorTabsProps) {
  return (
    <div className="editor-tabs" role="tablist" aria-label="Разделы редактора">
      <button
        aria-selected={activeTab === "map"}
        className={activeTab === "map" ? "active" : ""}
        role="tab"
        type="button"
        onClick={() => onTabChange("map")}
      >
        Карта
      </button>
      <button
        aria-selected={activeTab === "card"}
        className={activeTab === "card" ? "active" : ""}
        disabled={!hasSelectedCard}
        role="tab"
        type="button"
        onClick={() => onTabChange("card")}
      >
        Карточка
      </button>
    </div>
  );
}

type MapFieldsProps = {
  description: string;
  isPublished: boolean;
  title: string;
  onDescriptionChange: (value: string) => void;
  onPublishedChange: (value: boolean) => void;
  onTitleChange: (value: string) => void;
};

function MapFields({ description, isPublished, title, onDescriptionChange, onPublishedChange, onTitleChange }: MapFieldsProps) {
  return (
    <div className="editor-form-grid">
      <label>
        Название карты
        <input type="text" value={title} onChange={(event) => onTitleChange(event.target.value)} />
      </label>
      <label>
        Описание карты
        <textarea className="map-description-input" rows={7} value={description} onChange={(event) => onDescriptionChange(event.target.value)} />
      </label>
      <label className="checkbox-field">
        <input checked={isPublished} type="checkbox" onChange={(event) => onPublishedChange(event.target.checked)} />
        Опубликовать карту для игроков
      </label>
    </div>
  );
}

function toEditorObjectiveType(objective: CardObjective) {
  return objective.type === "capture_piece" ? "capture_pieces" : objective.type;
}

function createObjectiveByType(type: string, current: CardObjective): CardObjective {
  if (type === "give_check") return { type: "give_check" };
  if (type === "give_checks") {
    const checks = current.type === "give_checks" ? current.checks : 3;
    return { checks, type: "give_checks" };
  }
  if (type === "checkmate_in_moves") {
    const moves = current.type === "checkmate_in_moves" ? current.moves : 1;
    return { moves, type: "checkmate_in_moves" };
  }
  if (type === "survive_half_moves") {
    const halfMoves = current.type === "survive_half_moves" ? current.halfMoves : 8;
    return { halfMoves, type: "survive_half_moves" };
  }
  if (type === "capture_pieces") {
    const pieces = current.type === "capture_pieces" ? current.pieces : 1;
    return { pieces, type: "capture_pieces" };
  }

  return { type: "checkmate" };
}


function requestStockfishBestMove(fen: string, workerSrc: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof Worker === "undefined") {
      reject(new Error("Stockfish Web Worker не включен в этом браузере."));
      return;
    }

    let worker: Worker;
    try {
      worker = new Worker(workerSrc);
    } catch {
      reject(new Error("Stockfish Web Worker не смог загрузиться."));
      return;
    }

    const timeoutId = window.setTimeout(() => {
      worker.terminate();
      reject(new Error("Stockfish не ответил на тест позиции."));
    }, 5000);

    worker.onmessage = (event: MessageEvent<string>) => {
      const line = String(event.data).trim();
      if (!line) return;

      if (line === "uciok") {
        worker.postMessage("setoption name UCI_LimitStrength value false");
        worker.postMessage("setoption name Skill Level value 20");
        worker.postMessage("isready");
        return;
      }

      if (line === "readyok") {
        worker.postMessage("position fen " + fen);
        worker.postMessage("go movetime 1000");
        return;
      }

      if (line.startsWith("bestmove ")) {
        window.clearTimeout(timeoutId);
        worker.terminate();
        resolve(line.split(/\s+/)[1] ?? "");
      }
    };

    worker.onerror = () => {
      window.clearTimeout(timeoutId);
      worker.terminate();
      reject(new Error("Stockfish завершился с ошибкой при проверке позиции."));
    };

    worker.postMessage("uci");
  });
}

function uciToMove(bestMove: string) {
  return {
    from: bestMove.slice(0, 2),
    to: bestMove.slice(2, 4),
    promotion: bestMove[4],
  };
}

function formatUciMove(bestMove: string) {
  const from = bestMove.slice(0, 2);
  const to = bestMove.slice(2, 4);
  const promotion = bestMove[4] ? "=" + bestMove[4].toUpperCase() : "";
  return from && to ? from + "-" + to + promotion : bestMove;
}

function isNoEngineMove(bestMove: string) {
  return !bestMove || bestMove === "(none)" || bestMove === "0000";
}

function createInitialDrafts(cards: CardFenEditorProps["cards"]): EditorCardDraft[] {
  return cards.map((card) => ({
    slug: card.slug,
    order: card.order,
    title: card.title,
    text: card.text,
    congratulationsText: card.congratulationsText,
    fen: card.startingFen ?? card.initialFen ?? "",
    rewardGold: card.rewardGold,
    rewardScore: card.rewardScore,
    difficulty: card.difficulty,
    objective: card.objective ?? { type: "checkmate" },
  }));
}

function setFenBoardSquare(fen: string, square: string, piece: string | null) {
  const parts = getFenParts(fen);
  const board = parseFenBoard(parts[0]);
  const fileIndex = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number(square[1]);
  const rankIndex = 8 - rank;

  if (rankIndex < 0 || rankIndex > 7 || fileIndex < 0 || fileIndex > 7) return fen;

  board[rankIndex][fileIndex] = piece;
  parts[0] = serializeFenBoard(board);
  return parts.join(" ");
}

function setFenSideToMove(fen: string, side: "w" | "b") {
  const parts = getFenParts(fen);
  parts[1] = side;
  return parts.join(" ");
}

function getFenParts(fen: string) {
  const parts = (fen.trim() || STARTING_FEN).split(/\s+/);
  return [
    parts[0] || "8/8/8/8/8/8/8/8",
    parts[1] === "b" ? "b" : "w",
    parts[2] || "-",
    parts[3] || "-",
    parts[4] || "0",
    parts[5] || "1",
  ];
}

function parseFenBoard(boardPart: string) {
  return boardPart.split("/").map((row) => {
    const squares: Array<string | null> = [];

    for (const char of row) {
      if (/^[1-8]$/.test(char)) {
        for (let index = 0; index < Number(char); index += 1) squares.push(null);
      } else {
        squares.push(char);
      }
    }

    while (squares.length < 8) squares.push(null);
    return squares.slice(0, 8);
  }).concat(Array.from({ length: 8 }, () => Array<string | null>(8).fill(null))).slice(0, 8);
}

function serializeFenBoard(board: Array<Array<string | null>>) {
  return board.map((row) => {
    let empty = 0;
    let result = "";

    for (const piece of row) {
      if (!piece) {
        empty += 1;
        continue;
      }

      if (empty > 0) {
        result += String(empty);
        empty = 0;
      }
      result += piece;
    }

    return result + (empty > 0 ? String(empty) : "");
  }).join("/");
}

function getDraftValidationError(cards: EditorCardDraft[]) {
  for (const card of cards) {
    if (!card.title.trim()) return "Заполните название карточки " + card.order + ".";
    if (!card.text.trim()) return "Заполните текст карточки " + card.order + ".";
    if (!card.congratulationsText.trim()) return "Заполните поздравление карточки " + card.order + ".";
    if (card.rewardGold <= 0 || card.rewardScore <= 0) return "Награды карточки " + card.order + " должны быть больше нуля.";
    if ((card.objective.type === "survive_half_moves" && card.objective.halfMoves <= 0) || (card.objective.type === "capture_pieces" && card.objective.pieces <= 0) || (card.objective.type === "give_checks" && card.objective.checks <= 0)) {
      return "Цель карточки " + card.order + " должна иметь число больше нуля.";
    }
    if (card.objective.type === "checkmate_in_moves" && (card.objective.moves < 1 || card.objective.moves >= 100)) {
      return "Цель карточки " + card.order + " должна быть на 1-99 ходов.";
    }
    if (card.objective.type === "give_checks" && (card.objective.checks < 1 || card.objective.checks >= 100)) {
      return "Цель карточки " + card.order + " должна быть на 1-99 шахов.";
    }
    if (card.fen.trim()) {
      const result = validateBoardTemplateFen(card.fen);
      if (!result.ok) return "Исправьте FEN карточки " + card.order + ": " + result.issues[0]?.message;
    }
  }

  return "";
}
