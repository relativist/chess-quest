"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Chess, type Color, type Square } from "chess.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChessBoardView } from "@/components/chess-board-view";
import { fenToBoardSquares, type FenBoardSquare } from "@/lib/chess/fen-board";
import {
  onlineMatchAudioCues,
  type OnlineMatchAudioCue,
} from "@/lib/online/match-audio";
import type { OnlineColor, OnlineMatchSnapshot } from "@/lib/online/types";
import { publicPath } from "@/lib/routing/public-path";
import styles from "@/app/online/game/[matchId]/online-game.module.css";

type MagicId =
  | "promote_pawn_bishop"
  | "promote_pawn_knight"
  | "promote_pawn_rook"
  | "promote_pawn_queen";

type MatchSnapshot = OnlineMatchSnapshot;

type ApiErrorBody = {
  error?: { code?: string; message?: string };
};

type MagicOption = {
  id: MagicId;
  label: string;
  cost: number;
  piece: "bishop" | "knight" | "queen" | "rook";
};

const MAGIC_OPTIONS: MagicOption[] = [
  { id: "promote_pawn_bishop", label: "Слон", cost: 100, piece: "bishop" },
  { id: "promote_pawn_knight", label: "Конь", cost: 120, piece: "knight" },
  { id: "promote_pawn_rook", label: "Ладья", cost: 150, piece: "rook" },
  { id: "promote_pawn_queen", label: "Ферзь", cost: 220, piece: "queen" },
];

export function OnlineChessGameClient({ matchId }: { matchId: string }) {
  const router = useRouter();
  const mountedRef = useRef(true);
  const refreshPendingRef = useRef(false);
  const snapshotRef = useRef<MatchSnapshot | null>(null);
  const surrenderDialogRef = useRef<HTMLDialogElement>(null);
  const drawDialogRef = useRef<HTMLDialogElement>(null);
  const resultDialogRef = useRef<HTMLDialogElement>(null);
  const rematchDialogRef = useRef<HTMLDialogElement>(null);
  const announcedResultRef = useRef(false);
  const navigatedMatchRef = useRef<string | null>(null);
  const stepAudioRef = useRef<HTMLAudioElement>(null);
  const captureAudioRef = useRef<HTMLAudioElement>(null);
  const checkAudioRef = useRef<HTMLAudioElement>(null);
  const winAudioRef = useRef<HTMLAudioElement>(null);
  const defeatAudioRef = useRef<HTMLAudioElement>(null);
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  const [snapshotReceivedAt, setSnapshotReceivedAt] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [selectedMagic, setSelectedMagic] = useState<MagicId | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [surrenderDialogOpen, setSurrenderDialogOpen] = useState(false);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [error, setError] = useState("");
  const [, setClockTick] = useState(0);

  const applySnapshot = useCallback((next: MatchSnapshot) => {
    const current = snapshotRef.current;
    if (current && next.version < current.version) return;
    const positionChanged = !current || next.version > current.version;
    onlineMatchAudioCues(current, next).forEach((cue) => playAudio(cue));
    snapshotRef.current = next;
    setSnapshotReceivedAt(Date.now());
    setSnapshot(next);
    if (next.result && !announcedResultRef.current) {
      announcedResultRef.current = true;
      setResultDialogOpen(true);
    } else if (!next.result) {
      announcedResultRef.current = false;
      setResultDialogOpen(false);
    }
    if (positionChanged) {
      setSelectedSquare(null);
      setSelectedMagic(null);
    }

    function playAudio(cue: OnlineMatchAudioCue) {
      const refs = {
        capture: captureAudioRef,
        check: checkAudioRef,
        defeat: defeatAudioRef,
        step: stepAudioRef,
        win: winAudioRef,
      };
      const audio = refs[cue].current;
      if (!audio) return;
      audio.currentTime = 0;
      void audio.play().catch(() => undefined);
    }
  }, []);

  const refreshMatch = useCallback(async () => {
    if (refreshPendingRef.current) return;
    refreshPendingRef.current = true;

    try {
      const data = await matchRequest<{ snapshot: MatchSnapshot }>(
        publicPath(`/api/online/matches/${encodeURIComponent(matchId)}`),
      );
      if (!mountedRef.current) return;
      applySnapshot(data.snapshot);
      setError("");
    } catch (requestError) {
      if (mountedRef.current) setError(errorMessage(requestError));
    } finally {
      refreshPendingRef.current = false;
    }
  }, [applySnapshot, matchId]);

  useEffect(() => {
    mountedRef.current = true;
    const initialTimer = window.setTimeout(() => void refreshMatch(), 0);
    const pollTimer = window.setInterval(() => void refreshMatch(), 1_000);
    const clockTimer = window.setInterval(
      () => setClockTick((tick) => tick + 1),
      250,
    );

    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialTimer);
      window.clearInterval(pollTimer);
      window.clearInterval(clockTimer);
    };
  }, [refreshMatch]);

  const incomingDraw = Boolean(
    snapshot?.status === "ACTIVE" &&
    snapshot.draw.pendingOfferBy === "opponent",
  );
  const incomingRematch = snapshot?.rematch.state === "OFFERED_BY_OPPONENT";

  useEffect(() => {
    syncDialog(surrenderDialogRef.current, surrenderDialogOpen);
  }, [surrenderDialogOpen]);

  useEffect(() => {
    syncDialog(drawDialogRef.current, incomingDraw);
  }, [incomingDraw]);

  useEffect(() => {
    syncDialog(resultDialogRef.current, resultDialogOpen);
  }, [resultDialogOpen]);

  useEffect(() => {
    syncDialog(rematchDialogRef.current, incomingRematch && !resultDialogOpen);
  }, [incomingRematch, resultDialogOpen]);

  useEffect(() => {
    const nextMatchId = snapshot?.rematch.nextMatchId;
    if (!nextMatchId || navigatedMatchRef.current === nextMatchId) return;
    navigatedMatchRef.current = nextMatchId;
    router.replace("/online/game/" + encodeURIComponent(nextMatchId));
  }, [router, snapshot?.rematch.nextMatchId]);

  const chess = useMemo(() => {
    if (!snapshot) return null;
    try {
      return new Chess(snapshot.fen);
    } catch {
      return null;
    }
  }, [snapshot]);
  const boardSquares = useMemo(
    () => fenToBoardSquares(snapshot?.fen ?? "8/8/8/8/8/8/8/8 w - - 0 1"),
    [snapshot?.fen],
  );
  const interactive = Boolean(
    snapshot &&
    snapshot.status === "ACTIVE" &&
    snapshot.turnColor === snapshot.playerColor &&
    !actionPending,
  );
  const playerChessColor: Color = snapshot?.playerColor === "black" ? "b" : "w";
  const legalMoveSquares = useMemo(() => {
    if (!interactive || !chess) return [];
    if (selectedMagic) {
      return boardSquares
        .filter((square) => isOwnPawn(square, playerChessColor))
        .map((square) => square.square);
    }
    if (!selectedSquare) return [];
    return Array.from(
      new Set(
        chess
          .moves({ square: selectedSquare as Square, verbose: true })
          .map((move) => move.to),
      ),
    );
  }, [
    boardSquares,
    chess,
    interactive,
    playerChessColor,
    selectedMagic,
    selectedSquare,
  ]);

  async function handleSquareClick(square: FenBoardSquare) {
    if (!interactive || !snapshot || !chess) return;

    if (selectedMagic) {
      if (!isOwnPawn(square, playerChessColor)) return;
      await submitAction("magic", {
        magicId: selectedMagic,
        targetSquare: square.square,
      });
      return;
    }

    const clickedPiece = chess.get(square.square as Square);
    if (clickedPiece?.color === playerChessColor) {
      setSelectedSquare(square.square);
      return;
    }

    if (!selectedSquare || !legalMoveSquares.includes(square.square)) return;
    const candidates = chess
      .moves({ square: selectedSquare as Square, verbose: true })
      .filter((move) => move.to === square.square);
    const promotion = candidates.some((move) => Boolean(move.promotion));
    await submitAction("moves", {
      from: selectedSquare,
      to: square.square,
      ...(promotion ? { promotion: "q" } : {}),
    });
  }

  async function submitAction(
    endpoint: "moves" | "magic",
    action: Record<string, string>,
  ) {
    const current = snapshotRef.current;
    if (!current || actionPending) return;
    setActionPending(true);
    setError("");

    try {
      const data = await matchRequest<{ snapshot: MatchSnapshot }>(
        publicPath(
          `/api/online/matches/${encodeURIComponent(matchId)}/${endpoint}`,
        ),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...action,
            expectedVersion: current.version,
            clientRequestId: createRequestId(),
          }),
        },
      );
      if (mountedRef.current) applySnapshot(data.snapshot);
    } catch (requestError) {
      if (mountedRef.current) {
        setError(errorMessage(requestError));
        void refreshMatch();
      }
    } finally {
      if (mountedRef.current) setActionPending(false);
    }
  }

  async function submitMatchCommand(
    endpoint: "surrender" | "draw",
    action?: Record<string, string>,
  ) {
    const current = snapshotRef.current;
    if (!current || actionPending) return;
    setActionPending(true);
    setError("");

    try {
      const data = await matchRequest<{ snapshot: MatchSnapshot }>(
        dynamicPublicPath(
          "/api/online/matches/" + encodeURIComponent(matchId) + "/" + endpoint,
        ),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...action,
            expectedVersion: current.version,
            clientRequestId: createRequestId(),
          }),
        },
      );
      if (mountedRef.current) applySnapshot(data.snapshot);
    } catch (requestError) {
      if (mountedRef.current) {
        setError(errorMessage(requestError));
        void refreshMatch();
      }
    } finally {
      if (mountedRef.current) setActionPending(false);
    }
  }

  async function submitRematch(action: "offer" | "accept" | "decline") {
    const current = snapshotRef.current;
    if (!current || actionPending) return;
    setActionPending(true);
    setError("");

    try {
      const data = await matchRequest<{
        snapshot?: MatchSnapshot;
        nextMatchId?: string;
      }>(
        dynamicPublicPath(
          "/api/online/matches/" + encodeURIComponent(matchId) + "/rematch",
        ),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            ...(current.rematch.challengeId
              ? { challengeId: current.rematch.challengeId }
              : {}),
          }),
        },
      );
      if (!mountedRef.current) return;
      if (data.snapshot) applySnapshot(data.snapshot);
      const nextMatchId =
        data.nextMatchId ?? data.snapshot?.rematch.nextMatchId;
      if (nextMatchId) {
        navigatedMatchRef.current = nextMatchId;
        router.replace("/online/game/" + encodeURIComponent(nextMatchId));
      } else {
        void refreshMatch();
      }
    } catch (requestError) {
      if (mountedRef.current) {
        setError(errorMessage(requestError));
        void refreshMatch();
      }
    } finally {
      if (mountedRef.current) setActionPending(false);
    }
  }

  if (!snapshot) {
    return (
      <div className={styles.game}>
        <header className={styles.heading}>
          <div>
            <h1>Онлайн-партия</h1>
            <p>Получаем состояние матча…</p>
          </div>
        </header>
        {error ? (
          <div className={styles.error} role="alert">
            <p>{error}</p>
            <button
              className={styles.retryButton}
              type="button"
              onClick={() => void refreshMatch()}
            >
              Повторить
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const ownCoins = snapshot.magicCoins[snapshot.playerColor];
  const topColor: OnlineColor =
    snapshot.playerColor === "white" ? "black" : "white";
  const bottomColor: OnlineColor = snapshot.playerColor;
  const ownDrawPending = snapshot.draw.pendingOfferBy === "self";
  const resultArtwork = onlineResultArtwork(snapshot);

  return (
    <>
      <audio ref={stepAudioRef} preload="auto" src={publicPath("/assets/audio/music/step1.mp3")} />
      <audio ref={captureAudioRef} preload="auto" src={publicPath("/assets/audio/sfx/capture.mp3")} />
      <audio ref={checkAudioRef} preload="auto" src={publicPath("/assets/audio/sfx/check.mp3")} />
      <audio ref={winAudioRef} preload="auto" src={publicPath("/assets/audio/music/win1.mp3")} />
      <audio ref={defeatAudioRef} preload="auto" src={publicPath("/assets/audio/music/defeat1.mp3")} />
      <div className={styles.game}>
        <header className={styles.heading}>
        <div>
          <h1>Онлайн-партия</h1>
          <p>{statusText(snapshot)}</p>
        </div>
        <span className={styles.connectionStatus} data-error={Boolean(error)}>
          {error ? "Нет связи" : "Синхронизировано"}
        </span>
      </header>

      <div className={styles.layout}>
        <main className={styles.boardColumn}>
          <PlayerCard
            color={topColor}
            receivedAt={snapshotReceivedAt}
            snapshot={snapshot}
          />
          <div className={styles.boardPanel} aria-busy={actionPending}>
            <ChessBoardView
              ariaLabel="Доска онлайн-партии"
              squares={boardSquares}
              legalMoveSquares={legalMoveSquares}
              onSquareClick={
                interactive
                  ? (square) => void handleSquareClick(square)
                  : undefined
              }
              orientation={snapshot.playerColor}
              selectedSquare={selectedSquare}
            />
          </div>
          <PlayerCard
            color={bottomColor}
            receivedAt={snapshotReceivedAt}
            snapshot={snapshot}
          />
        </main>

        <aside className={styles.sidePanel}>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <p className={styles.notice} role="status">
            {actionPending
              ? "Ждём подтверждение сервера…"
              : selectedMagic
                ? "Выберите свою пешку на доске."
                : interactive
                  ? "Ваш ход."
                  : snapshot.status === "ACTIVE"
                    ? "Ход соперника."
                    : "Партия завершена."}
          </p>

          <section
            className={styles.magicSection}
            aria-labelledby="online-magic-title"
          >
            <div className={styles.magicHeader}>
              <h2 id="online-magic-title">
                <Image className={styles.magicTitleIcon} src={publicPath("/assets/images/icons/magic.png")} alt="" width={64} height={64} />
                <span>Магия</span>
              </h2>
              <span className={styles.magicBalance}>
                <Image src={publicPath("/assets/images/icons/chest.png")} alt="Сундук" width={44} height={44} />
                <strong>{ownCoins}</strong>
                <Image className={styles.coinIcon} src={publicPath("/assets/images/icons/coin2.png")} alt="монет" width={18} height={18} />
              </span>
            </div>
            <div className={styles.magicGrid}>
              {MAGIC_OPTIONS.map((option) => (
                <button
                  className={styles.magicButton}
                  type="button"
                  key={option.id}
                  aria-label={option.label + ", " + option.cost + " монет"}
                  aria-pressed={selectedMagic === option.id}
                  disabled={!interactive || ownCoins < option.cost}
                  title={option.label + ". Стоимость: " + option.cost + " монет"}
                  onClick={() => {
                    setSelectedSquare(null);
                    setSelectedMagic((current) =>
                      current === option.id ? null : option.id,
                    );
                  }}
                >
                  <Image className={styles.magicPieceIcon} src={onlineMagicPieceIcon(option, snapshot.playerColor)} alt="" width={42} height={42} />
                  <span className={styles.magicPrice}>
                    <span>{option.cost}</span>
                    <Image className={styles.coinIcon} src={publicPath("/assets/images/icons/coin2.png")} alt="" width={16} height={16} />
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section
            className={styles.actionSection}
            aria-labelledby="online-actions-title"
          >
            <h2 id="online-actions-title">
              {snapshot.status === "ACTIVE"
                ? "Действия партии"
                : "Партия завершена"}
            </h2>
            {snapshot.status === "ACTIVE" ? (
              <>
                <div className={styles.actionGrid}>
                  <button
                    className={`${styles.dangerButton} ${styles.iconActionButton}`}
                    type="button"
                    aria-label="Сдаться"
                    title="Сдаться"
                    disabled={actionPending}
                    onClick={() => setSurrenderDialogOpen(true)}
                  >
                    <Image className={styles.actionIcon} src={publicPath("/assets/images/icons/surrender.png")} alt="" width={72} height={72} />
                  </button>
                  <button
                    className={`${styles.secondaryButton} ${styles.iconActionButton}`}
                    type="button"
                    aria-label={"Предложить ничью. Осталось предложений: " + snapshot.draw.offersRemaining}
                    title="Предложить ничью"
                    disabled={
                      actionPending ||
                      ownDrawPending ||
                      Boolean(snapshot.draw.pendingOfferBy) ||
                      snapshot.draw.offersRemaining <= 0
                    }
                    onClick={() =>
                      void submitMatchCommand("draw", { action: "offer" })
                    }
                  >
                    <Image className={styles.actionIcon} src={publicPath("/assets/images/icons/draw.png")} alt="" width={72} height={72} />
                    <span className={styles.actionCount} aria-hidden="true">{snapshot.draw.offersRemaining}</span>
                  </button>
                </div>
                {ownDrawPending ? (
                  <p className={styles.actionHint} role="status">
                    Предложение ничьей отправлено. Ждём ответа соперника.
                  </p>
                ) : null}
              </>
            ) : (
              <div className={styles.terminalActions}>
                <button
                  className={`${styles.secondaryButton} ${styles.iconActionButton}`}
                  type="button"
                  aria-label={rematchButtonText(snapshot.rematch.state)}
                  title={rematchButtonText(snapshot.rematch.state)}
                  disabled={
                    actionPending ||
                    snapshot.rematch.state === "OFFERED_BY_YOU" ||
                    snapshot.rematch.state === "MATCH_CREATED"
                  }
                  onClick={() =>
                    void submitRematch(
                      snapshot.rematch.state === "OFFERED_BY_OPPONENT"
                        ? "accept"
                        : "offer",
                    )
                  }
                >
                  <Image className={styles.actionIcon} src={publicPath("/assets/images/icons/revenge.png")} alt="" width={72} height={72} />
                </button>
                <Link
                  className={`${styles.onlineLink} ${styles.iconActionButton}`}
                  href="/start"
                  aria-label="Назад к выбору режима"
                  title="Назад к выбору режима"
                >
                  <Image className={styles.actionIcon} src={publicPath("/assets/images/icons/back.png")} alt="" width={72} height={72} />
                </Link>
              </div>
            )}
            {snapshot.rematch.state === "OFFERED_BY_YOU" ? (
              <p className={styles.actionHint} role="status">
                Реванш предложен. Ждём ответа соперника.
              </p>
            ) : null}
          </section>

          <section
            className={styles.historySection}
            aria-labelledby="online-history-title"
          >
            <h2 id="online-history-title">История</h2>
            {snapshot.history.length ? (
              <ol className={styles.history}>
                {snapshot.history.map((entry) => (
                  <li key={`${entry.sequence}-${entry.createdAt}`}>
                    <span className={styles.historyNumber}>
                      {entry.sequence}.
                    </span>
                    <span>{entry.notation || historyTypeText(entry.type)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.emptyHistory}>Ходов пока нет.</p>
            )}
          </section>
        </aside>
      </div>

      <dialog
        className={styles.nativeDialog}
        ref={surrenderDialogRef}
        onCancel={() => setSurrenderDialogOpen(false)}
        onClose={() => setSurrenderDialogOpen(false)}
        aria-labelledby="online-surrender-title"
      >
        <h2 id="online-surrender-title">Сдаться?</h2>
        <p>Партия сразу завершится поражением.</p>
        <div className={`${styles.dialogActions} ${styles.labeledDialogActions} ${styles.twoColumnDialogActions}`}>
          <button
            className={`${styles.dangerButton} ${styles.iconActionButton} ${styles.labeledDialogAction}`}
            type="button"
            disabled={actionPending}
            onClick={() => {
              setSurrenderDialogOpen(false);
              void submitMatchCommand("surrender");
            }}
          >
            <Image className={styles.actionIcon} src={publicPath("/assets/images/icons/surrender.png")} alt="" width={72} height={72} />
            <span>Да, сдаться</span>
          </button>
          <button
            className={`${styles.secondaryButton} ${styles.iconActionButton} ${styles.labeledDialogAction}`}
            type="button"
            autoFocus
            onClick={() => setSurrenderDialogOpen(false)}
          >
            <Image className={styles.actionIcon} src={publicPath("/assets/images/icons/back.png")} alt="" width={72} height={72} />
            <span>Продолжить игру</span>
          </button>
        </div>
      </dialog>

      <dialog
        className={styles.nativeDialog}
        ref={drawDialogRef}
        onCancel={(event) => event.preventDefault()}
        aria-labelledby="online-draw-title"
      >
        <h2 id="online-draw-title">Соперник предлагает ничью</h2>
        <p>Принять предложение и завершить партию?</p>
        <div className={`${styles.dialogActions} ${styles.labeledDialogActions} ${styles.twoColumnDialogActions}`}>
          <button
            className={`${styles.primaryButton} ${styles.iconActionButton} ${styles.labeledDialogAction}`}
            type="button"
            autoFocus
            disabled={actionPending}
            onClick={() =>
              void submitMatchCommand("draw", { action: "accept" })
            }
          >
            <Image className={styles.actionIcon} src={publicPath("/assets/images/icons/ok.png")} alt="" width={72} height={72} />
            <span>Согласиться</span>
          </button>
          <button
            className={`${styles.secondaryButton} ${styles.iconActionButton} ${styles.labeledDialogAction}`}
            type="button"
            disabled={actionPending}
            onClick={() =>
              void submitMatchCommand("draw", { action: "decline" })
            }
          >
            <Image className={styles.actionIcon} src={publicPath("/assets/images/icons/reject.png")} alt="" width={72} height={72} />
            <span>Отказаться</span>
          </button>
        </div>
      </dialog>

      {snapshot.result ? (
        <dialog
          className={styles.nativeDialog}
          ref={resultDialogRef}
          onCancel={() => setResultDialogOpen(false)}
          onClose={() => setResultDialogOpen(false)}
          aria-labelledby="online-result-title"
        >
          <h2 id="online-result-title">{resultTitle(snapshot)}</h2>
          {resultArtwork ? (
            <div className={styles.resultArtwork}>
              <Image src={resultArtwork.src} alt={resultArtwork.alt} width={360} height={360} />
            </div>
          ) : null}
          <p>{finishReasonText(snapshot.result.reason)}</p>
          <div className={`${styles.dialogActions} ${styles.labeledDialogActions}`}>
            <button
              className={`${styles.secondaryButton} ${styles.iconActionButton} ${styles.labeledDialogAction}`}
              type="button"
              aria-label="К доске"
              title="К доске"
              autoFocus
              onClick={() => setResultDialogOpen(false)}
            >
              <Image className={styles.actionIcon} src={publicPath("/assets/images/icons/chess-board.png")} alt="" width={72} height={72} />
              <span>К доске</span>
            </button>
            <Link
              className={`${styles.onlineLink} ${styles.iconActionButton} ${styles.labeledDialogAction}`}
              href="/start"
              aria-label="Назад к выбору режима"
              title="Назад к выбору режима"
            >
              <Image className={styles.actionIcon} src={publicPath("/assets/images/icons/back.png")} alt="" width={72} height={72} />
              <span>Назад к выбору режима</span>
            </Link>
            <button
              className={`${styles.primaryButton} ${styles.iconActionButton} ${styles.labeledDialogAction}`}
              type="button"
              aria-label={rematchButtonText(snapshot.rematch.state)}
              title={rematchButtonText(snapshot.rematch.state)}
              disabled={
                actionPending ||
                snapshot.rematch.state === "OFFERED_BY_YOU" ||
                snapshot.rematch.state === "MATCH_CREATED"
              }
              onClick={() => {
                setResultDialogOpen(false);
                void submitRematch(
                  snapshot.rematch.state === "OFFERED_BY_OPPONENT"
                    ? "accept"
                    : "offer",
                );
              }}
            >
              <Image className={styles.actionIcon} src={publicPath("/assets/images/icons/revenge.png")} alt="" width={72} height={72} />
              <span>Реванш</span>
            </button>
          </div>
        </dialog>
      ) : null}

      <dialog
        className={styles.nativeDialog}
        ref={rematchDialogRef}
        onCancel={(event) => event.preventDefault()}
        aria-labelledby="online-rematch-title"
      >
        <h2 id="online-rematch-title">Соперник предлагает реванш</h2>
        <p>Начать новую партию с новым случайным цветом фигур?</p>
        <div className={`${styles.dialogActions} ${styles.labeledDialogActions} ${styles.twoColumnDialogActions}`}>
          <button
            className={`${styles.primaryButton} ${styles.iconActionButton} ${styles.labeledDialogAction}`}
            type="button"
            autoFocus
            disabled={actionPending}
            onClick={() => void submitRematch("accept")}
          >
            <Image className={styles.actionIcon} src={publicPath("/assets/images/icons/ok.png")} alt="" width={72} height={72} />
            <span>Принять</span>
          </button>
          <button
            className={`${styles.secondaryButton} ${styles.iconActionButton} ${styles.labeledDialogAction}`}
            type="button"
            disabled={actionPending}
            onClick={() => void submitRematch("decline")}
          >
            <Image className={styles.actionIcon} src={publicPath("/assets/images/icons/reject.png")} alt="" width={72} height={72} />
            <span>Отказаться</span>
          </button>
        </div>
      </dialog>
      </div>
    </>
  );
}

function onlineMagicPieceIcon(option: MagicOption, color: OnlineColor): string {
  const path = (
    "/assets/images/pieces/default/" + color + "-" + option.piece + ".png"
  ) as `/${string}`;
  return publicPath(path);
}

function PlayerCard({
  color,
  receivedAt,
  snapshot,
}: {
  color: OnlineColor;
  receivedAt: number;
  snapshot: MatchSnapshot;
}) {
  const player = snapshot.players[color];
  const isActive =
    snapshot.status === "ACTIVE" && snapshot.clocks.activeColor === color;
  const timeMs = displayedClock(snapshot, color, receivedAt);

  return (
    <section
      className={styles.playerCard}
      data-active={isActive}
      aria-label={`${color === "white" ? "Белые" : "Чёрные"}: ${player.name}`}
    >
      <div>
        <div className={styles.playerName}>
          {player.name}
          {snapshot.playerColor === color ? " (вы)" : ""}
        </div>
        <span className={styles.rating}>Рейтинг: {player.onlineRating}</span>
      </div>
      <span className={styles.coins}>
        <span>Монеты: {snapshot.magicCoins[color]}</span>
        <Image className={styles.playerCoinIcon} src={publicPath("/assets/images/icons/coin.png")} alt="монет" width={24} height={24} />
      </span>
      <time className={styles.clock}>{formatClock(timeMs)}</time>
    </section>
  );
}

function displayedClock(
  snapshot: MatchSnapshot,
  color: OnlineColor,
  receivedAt: number,
): number {
  const stored =
    color === "white"
      ? snapshot.clocks.whiteTimeMs
      : snapshot.clocks.blackTimeMs;
  if (snapshot.status !== "ACTIVE" || snapshot.clocks.activeColor !== color)
    return stored;
  return Math.max(0, stored - Math.max(0, Date.now() - receivedAt));
}

function formatClock(timeMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(timeMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function isOwnPawn(square: FenBoardSquare, playerColor: Color): boolean {
  if (!square.piece || square.piece.code.toLowerCase() !== "p") return false;
  const pieceColor: Color =
    square.piece.code === square.piece.code.toUpperCase() ? "w" : "b";
  return pieceColor === playerColor;
}

function statusText(snapshot: MatchSnapshot): string {
  if (snapshot.status !== "ACTIVE") return "Партия завершена";
  return snapshot.turnColor === snapshot.playerColor
    ? "Ваш ход"
    : "Ход соперника";
}

function onlineResultArtwork(snapshot: MatchSnapshot) {
  const outcome = snapshot.result?.outcome;
  if (!outcome || outcome === "DRAW") return null;

  const playerWon = outcome === snapshot.playerColor.toUpperCase() + "_WIN";
  return {
    alt: playerWon ? "Победа" : "Поражение",
    src: publicPath(
      playerWon
        ? "/assets/images/battle/online-win.png"
        : "/assets/images/battle/online-lose.png",
    ),
  };
}

function resultTitle(snapshot: MatchSnapshot): string {
  const outcome = snapshot.result?.outcome;
  if (outcome === "DRAW") return "Ничья";
  const playerWon = outcome === snapshot.playerColor.toUpperCase() + "_WIN";
  return playerWon ? "Победа!" : "Поражение";
}

function finishReasonText(reason: string): string {
  const labels: Record<string, string> = {
    CHECKMATE: "Мат поставлен.",
    TIMEOUT: "Время одного из игроков закончилось.",
    SURRENDER: "Один из игроков сдался.",
    DRAW_AGREEMENT: "Партия завершилась вничью.",
    STALEMATE: "Пат. Партия завершилась вничью.",
    INSUFFICIENT_MATERIAL: "Недостаточно материала для мата.",
    THREEFOLD_REPETITION: "Позиция повторилась три раза.",
    FIFTY_MOVE_RULE: "Сработало правило пятидесяти ходов.",
  };
  return (
    labels[reason] ?? "Партия завершена. Можно вернуться к списку игроков."
  );
}

function historyTypeText(type: string): string {
  const labels: Record<string, string> = {
    MOVE: "Ход",
    MAGIC: "Применена магия",
    SURRENDERED: "Игрок сдался",
    DRAW_OFFERED: "Предложена ничья",
    DRAW_ACCEPTED: "Предложение ничьей принято",
    DRAW_DECLINED: "Предложение ничьей отклонено",
    TIMED_OUT: "Время истекло",
  };
  return labels[type] ?? type;
}

function rematchButtonText(state: MatchSnapshot["rematch"]["state"]): string {
  const labels: Record<MatchSnapshot["rematch"]["state"], string> = {
    NONE: "Предложить реванш",
    OFFERED_BY_YOU: "Реванш предложен",
    OFFERED_BY_OPPONENT: "Принять реванш",
    MATCH_CREATED: "Открываем реванш…",
  };
  return labels[state];
}

function syncDialog(
  dialog: HTMLDialogElement | null,
  shouldOpen: boolean,
): void {
  if (!dialog) return;
  if (shouldOpen && !dialog.open) {
    dialog.showModal();
    window.requestAnimationFrame(() => {
      const focusTarget = dialog.querySelector<HTMLElement>(
        "[autofocus], button, a[href]",
      );
      focusTarget?.focus();
    });
  } else if (!shouldOpen && dialog.open) {
    dialog.close();
  }
}

function createRequestId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

async function matchRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = (await response.json().catch(() => null)) as
    T | ApiErrorBody | null;
  if (!response.ok) {
    const apiError = body as ApiErrorBody | null;
    throw new Error(
      apiError?.error?.message || "Не удалось синхронизировать онлайн-партию.",
    );
  }
  if (!body) throw new Error("Сервер вернул пустой ответ.");
  return body as T;
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Не удалось выполнить действие.";
}

function dynamicPublicPath(path: string) {
  return publicPath(path as Parameters<typeof publicPath>[0]);
}
