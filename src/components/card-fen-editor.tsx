"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveMapEditorAction } from "@/app/map/editor/actions";
import { ChessBoardView } from "@/components/chess-board-view";
import { RightSideToast } from "@/components/right-side-toast";
import { fenToBoardSquares } from "@/lib/chess/fen-board";
import { STARTING_FEN, validateBoardTemplateFen } from "@/lib/chess/fen-validation";
import type { DemoQuestCardSeed } from "@/lib/demo-seed";
import { normalizeCardObjective, objectiveShortLabel, type CardObjective } from "@/lib/quest/card-objectives";
import type { MapEditorCardInput } from "@/lib/quest/quest-repository";

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
  text: string;
  tone: "error" | "success";
};

export function CardFenEditor({ cards, mapDescription, mapIsPublished, mapSlug, mapTitle }: CardFenEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(mapTitle);
  const [description, setDescription] = useState(mapDescription);
  const [isPublished, setIsPublished] = useState(mapIsPublished);
  const [editorCards, setEditorCards] = useState<EditorCardDraft[]>(() => createInitialDrafts(cards));
  const [selectedSlug, setSelectedSlug] = useState(() => cards[0]?.slug ?? "");
  const [notification, setNotification] = useState<EditorNotification | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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
  const sideToMoveLabel = validation.sideToMove === "black" ? "Черные" : "Белые";

  useEffect(() => {
    if (!notification) return;

    const timeoutId = window.setTimeout(() => setNotification(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [notification]);

  function updateSelectedDraft(nextDraft: Partial<Pick<EditorCardDraft, "congratulationsText" | "difficulty" | "fen" | "objective" | "rewardGold" | "rewardScore" | "text" | "title">>) {
    if (!selectedCard) return;
    setNotification(null);
    setEditorCards((current) => current.map((card) => (card.slug === selectedCard.slug ? { ...card, ...nextDraft } : card)));
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
  }

  function showNotification(text: string, tone: EditorNotification["tone"]) {
    setNotification({ id: Date.now(), text, tone });
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

    showNotification("Карта сохранена в PostgreSQL.", "success");
    router.refresh();
  }

  if (!selectedCard) {
    return (
      <div className="editor-layout">
        <aside className="editor-card-list" aria-label="Карточки карты">
          <button className="add-card-button" type="button" onClick={addCard}>+ Добавить карточку</button>
        </aside>

        <section className="editor-panel" aria-label="Редактирование карты">
          <div className="editor-form-grid">
            <label>
              Название карты
              <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
              Описание карты
              <textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <label className="checkbox-field">
              <input checked={isPublished} type="checkbox" onChange={(event) => setIsPublished(event.target.checked)} />
              Опубликовать карту для игроков
            </label>
          </div>

          <div className="position-note">На этой карте пока нет карточек. Добавьте первую карточку слева.</div>

          {notification ? <RightSideToast key={notification.id} message={notification.text} tone={notification.tone} /> : null}

          <div className="editor-actions">
            <button type="button" disabled={isSaving} onClick={saveMap}>
              {isSaving ? "Сохранение..." : "Сохранить карту"}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="editor-layout">
      <aside className="editor-card-list" aria-label="Карточки карты">
        <button className="add-card-button" type="button" onClick={addCard}>+ Добавить карточку</button>
        {editorCards.map((card) => (
          <button
            className={card.slug === selectedCard.slug ? "selected" : ""}
            key={card.slug}
            type="button"
            onClick={() => setSelectedSlug(card.slug)}
          >
            <span>{card.order}</span>
            <strong>{card.title}</strong>
          </button>
        ))}
      </aside>

      <section className="editor-panel" aria-label="Редактирование карты">
        <div className="editor-form-grid">
          <label>
            Название карты
            <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label>
            Описание карты
            <textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label className="checkbox-field">
            <input checked={isPublished} type="checkbox" onChange={(event) => setIsPublished(event.target.checked)} />
            Опубликовать карту для игроков
          </label>
        </div>

        <div className="editor-heading">
          <div>
            <p className="eyebrow">Карточка {selectedCard.order}</p>
            <h2>{selectedCard.title}</h2>
          </div>
          <div className={validation.ok ? "validation-pill ok" : "validation-pill error"}>
            {validation.ok ? "FEN валиден" : "FEN с ошибками"}
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
                <option value="give_check">Поставить шах</option>
                <option value="survive_half_moves">Продержаться N полуходов</option>
                <option value="capture_pieces">Съесть N фигур противника</option>
              </select>
            </label>
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
            FEN позиции
            <textarea
              rows={5}
              spellCheck={false}
              value={draftFen}
              placeholder={STARTING_FEN}
              onChange={(event) => updateSelectedDraft({ fen: event.target.value })}
            />
          </label>
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
        </div>

        <dl className="editor-summary">
          <div>
            <dt>Пустое поле</dt>
            <dd>Стандартная расстановка</dd>
          </div>
          <div>
            <dt>Первый ход</dt>
            <dd>{sideToMoveLabel}</dd>
          </div>
          <div>
            <dt>Цель</dt>
            <dd>{objectiveShortLabel(selectedCard.objective)}</dd>
          </div>
          <div>
            <dt>Награда</dt>
            <dd>{selectedCard.rewardScore} очков / {selectedCard.rewardGold} золота</dd>
          </div>
        </dl>

        {!validation.ok ? (
          <div className="fen-errors" role="alert">
            {validation.issues.map((issue) => (
              <p key={issue.code + ":" + issue.message}>{issue.message}</p>
            ))}
          </div>
        ) : null}

        {notification ? <RightSideToast key={notification.id} message={notification.text} tone={notification.tone} /> : null}

        <div className="editor-preview-row">
          <ChessBoardView ariaLabel="Предпросмотр FEN" className="editor-board" squares={previewSquares} />
          <div className="editor-actions">
            <button type="button" disabled={!validation.ok || isSaving} onClick={saveMap}>
              {isSaving ? "Сохранение..." : "Сохранить карту"}
            </button>
            <p>{validation.ok ? validation.fen : "Исправьте FEN перед сохранением"}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function toEditorObjectiveType(objective: CardObjective) {
  return objective.type === "capture_piece" ? "capture_pieces" : objective.type;
}

function createObjectiveByType(type: string, current: CardObjective): CardObjective {
  if (type === "give_check") return { type: "give_check" };
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

function getDraftValidationError(cards: EditorCardDraft[]) {
  for (const card of cards) {
    if (!card.title.trim()) return "Заполните название карточки " + card.order + ".";
    if (!card.text.trim()) return "Заполните текст карточки " + card.order + ".";
    if (!card.congratulationsText.trim()) return "Заполните поздравление карточки " + card.order + ".";
    if (card.rewardGold <= 0 || card.rewardScore <= 0) return "Награды карточки " + card.order + " должны быть больше нуля.";
    if ((card.objective.type === "survive_half_moves" && card.objective.halfMoves <= 0) || (card.objective.type === "capture_pieces" && card.objective.pieces <= 0)) {
      return "Цель карточки " + card.order + " должна иметь число больше нуля.";
    }
    if (card.fen.trim()) {
      const result = validateBoardTemplateFen(card.fen);
      if (!result.ok) return "Исправьте FEN карточки " + card.order + ": " + result.issues[0]?.message;
    }
  }

  return "";
}
