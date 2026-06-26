"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Move, type Square } from "chess.js";
import { ChessBoardView } from "@/components/chess-board-view";
import { fenToBoardSquares, type FenBoardSquare } from "@/lib/chess/fen-board";
import { getEngineDifficulty } from "@/lib/chess/engine-difficulty";
import { evaluateCardObjective, objectiveProgressLabel, type CardObjective } from "@/lib/quest/card-objectives";
import { MAGIC_UPGRADES, type MagicUpgradeSpec } from "@/lib/quest/magic-upgrades";
import { publicPath } from "@/lib/routing/public-path";

type PlayerSide = "black" | "white";
type EngineStatus = "error" | "loading" | "ready" | "thinking";

type ChessGameClientProps = {
  backIconSrc: string;
  cardDifficultyLabel: string;
  cardOrder: number;
  cardSlug: string;
  cardStars: string;
  cardTitle: string;
  coinIconSrc: string;
  completeCardAction: (formData: FormData) => void | Promise<void>;
  congratulationsText: string;
  defeatedEnemyImageSrc: string;
  defeatedHeroImageSrc: string;
  defeatSoundSrc: string;
  difficulty: number;
  initialFen: string;
  objective: CardObjective;
  objectiveLabel: string;
  playerGold: number;
  playerSide: PlayerSide;
  resetIconSrc: string;
  rewardGold: number;
  rewardScore: number;
  sideToMoveLabel: string;
  spendMagicGoldAction: (formData: FormData) => Promise<SpendMagicGoldResult>;
  stepSoundSrc: string;
  stockfishWorkerSrc: string;
  templateName: string;
  winSoundSrc: string;
};

type GameNotice = {
  tone: "error" | "info" | "success";
  text: string;
};

type PendingEngineRequest = {
  fen: string;
  mode: "apply" | "hint" | "magic_hint";
};

type EngineHintMove = {
  from: Square;
  to: Square;
};

type SpendMagicGoldResult = {
  availableGold: number;
  error?: string;
  ok: boolean;
};

export function ChessGameClient({
  backIconSrc,
  cardDifficultyLabel,
  cardOrder,
  cardSlug,
  cardStars,
  cardTitle,
  coinIconSrc,
  completeCardAction,
  congratulationsText,
  defeatedEnemyImageSrc,
  defeatedHeroImageSrc,
  defeatSoundSrc,
  difficulty,
  initialFen,
  objective,
  objectiveLabel,
  playerGold,
  playerSide,
  resetIconSrc,
  rewardGold,
  rewardScore,
  sideToMoveLabel,
  spendMagicGoldAction,
  stepSoundSrc,
  stockfishWorkerSrc,
  templateName,
  winSoundSrc,
}: ChessGameClientProps) {
  const [fen, setFen] = useState(initialFen);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [playerCapturedPieces, setPlayerCapturedPieces] = useState(0);
  const [fenHistory, setFenHistory] = useState<string[]>([initialFen]);
  const [defeatDialogOpen, setDefeatDialogOpen] = useState(false);
  const [defeatReason, setDefeatReason] = useState("Партия завершилась поражением.");
  const [drawDialogOpen, setDrawDialogOpen] = useState(false);
  const [drawReason, setDrawReason] = useState("Партия завершилась вничью.");
  const [victoryDialogOpen, setVictoryDialogOpen] = useState(false);
  const [victoryReason, setVictoryReason] = useState("Победа засчитана.");
  const [engineStatus, setEngineStatus] = useState<EngineStatus>("loading");
  const [engineHintMove, setEngineHintMove] = useState<EngineHintMove | null>(null);
  const [engineErrorDialogOpen, setEngineErrorDialogOpen] = useState(false);
  const [engineErrorText, setEngineErrorText] = useState("Ошибка движка Stockfish.");
  const [availableGold, setAvailableGold] = useState(playerGold);
  const [activeMagic, setActiveMagic] = useState<MagicUpgradeSpec | null>(null);
  const [magicPending, setMagicPending] = useState(false);
  const [notice, setNotice] = useState<GameNotice>({
    tone: "info",
    text: `Вы играете за ${sideLabel(playerSide).toLowerCase()}. Выберите фигуру стороны, которая сейчас ходит.`,
  });

  const workerRef = useRef<Worker | null>(null);
  const pendingEngineRequestRef = useRef<PendingEngineRequest | null>(null);
  const handleBestMoveRef = useRef<(line: string) => void>(() => undefined);
  const stepAudioRef = useRef<HTMLAudioElement | null>(null);
  const winAudioRef = useRef<HTMLAudioElement | null>(null);
  const defeatAudioRef = useRef<HTMLAudioElement | null>(null);
  const fenRef = useRef(fen);
  const moveHistoryRef = useRef(moveHistory);
  const playerCapturedPiecesRef = useRef(playerCapturedPieces);
  const playerTurn = playerSideToTurn(playerSide);
  const engineDifficulty = getEngineDifficulty(difficulty);

  const chess = useMemo(() => new Chess(fen), [fen]);
  const boardSquares = useMemo(() => fenToBoardSquares(fen), [fen]);
  const legalMoves = useMemo(() => {
    if (activeMagic || !selectedSquare || isGameOver(chess) || engineStatus === "thinking") return [];
    return chess.moves({ square: selectedSquare, verbose: true }) as Move[];
  }, [activeMagic, chess, engineStatus, selectedSquare]);
  const legalMoveSquares = legalMoves.map((move) => move.to);
  const ownPawnSquares = getOwnPawnSquares(boardSquares, playerTurn);
  const highlightedSquares = activeMagic?.target === "own_pawn" ? ownPawnSquares : legalMoveSquares;
  const status = getGameStatus(chess);
  const isPlayerTurn = chess.turn() === playerTurn;
  const canAskEngine = engineStatus === "ready" && !isGameOver(chess);
  const hasEngineHint = Boolean(engineHintMove);
  const canAcceptEngineSurrender = engineStatus !== "loading" && !isGameOver(chess);
  const canUndoFullTurn = fenHistory.length > 2;
  const objectiveProgress = objectiveProgressLabel(objective, moveHistory.length, playerCapturedPieces);

  useEffect(() => {
    fenRef.current = fen;
  }, [fen]);

  useEffect(() => {
    moveHistoryRef.current = moveHistory;
  }, [moveHistory]);

  useEffect(() => {
    playerCapturedPiecesRef.current = playerCapturedPieces;
  }, [playerCapturedPieces]);

  function cancelPendingEngineMove() {
    if (pendingEngineRequestRef.current) {
      workerRef.current?.postMessage("stop");
      pendingEngineRequestRef.current = null;
      setEngineStatus((current) => (current === "thinking" ? "ready" : current));
    }
  }

  function showEngineError(message: string) {
    pendingEngineRequestRef.current = null;
    setEngineStatus((current) => (current === "thinking" ? "ready" : current));
    setEngineErrorText(message);
    setEngineErrorDialogOpen(true);
    setNotice({ tone: "error", text: message });
  }

  function openObjectiveVictory(reason: string) {
    setSelectedSquare(null);
    setEngineHintMove(null);
    setActiveMagic(null);
    setDefeatDialogOpen(false);
    setDrawDialogOpen(false);
    setEngineErrorDialogOpen(false);
    setVictoryReason(reason);
    setVictoryDialogOpen(true);
    setNotice({ tone: "success", text: reason });
    playAudio(winAudioRef);
  }

  function openDrawDialog(reason: string) {
    setSelectedSquare(null);
    setEngineHintMove(null);
    setActiveMagic(null);
    setDefeatDialogOpen(false);
    setDrawDialogOpen(false);
    setEngineErrorDialogOpen(false);
    setVictoryDialogOpen(false);
    setDrawReason(reason);
    setDrawDialogOpen(true);
    setNotice({ tone: "info", text: reason });
  }

  function openDefeatDialog(reason: string) {
    setSelectedSquare(null);
    setEngineHintMove(null);
    setActiveMagic(null);
    setVictoryDialogOpen(false);
    setDrawDialogOpen(false);
    setEngineErrorDialogOpen(false);
    setDefeatReason(reason);
    setDefeatDialogOpen(true);
    setNotice({ tone: "error", text: reason });
    playAudio(defeatAudioRef);
  }

  function acceptEngineSurrender(reason = "Stockfish сдался. Победа игрока засчитана.") {
    cancelPendingEngineMove();
    openObjectiveVictory(reason);
  }

  function handleTerminalEnginePosition(chessPosition: Chess) {
    if (chessPosition.isCheckmate()) {
      if (chessPosition.turn() === playerTurn) {
        openDefeatDialog("Мат. Stockfish выиграл партию.");
        return;
      }

      openObjectiveVictory("Stockfish получил мат и не может продолжить.");
      return;
    }

    if (chessPosition.isDraw()) {
      openDrawDialog(getDrawReason(chessPosition));
      return;
    }

    acceptEngineSurrender("Stockfish не нашел продолжения и сдался.");
  }

  function handleBestMove(line: string) {
    const bestMove = line.split(/\s+/)[1] ?? "";
    const request = pendingEngineRequestRef.current;
    pendingEngineRequestRef.current = null;
    setEngineStatus("ready");

    if (!request) return;

    if (isNoEngineMove(bestMove)) {
      if (request.mode === "apply") {
        handleTerminalEnginePosition(new Chess(request.fen));
        return;
      }

      showEngineError("Stockfish не вернул легальный ход для этой позиции.");
      return;
    }

    const moveLabel = formatUciMove(bestMove);
    if (request.mode === "hint" || request.mode === "magic_hint") {
      const hintedMove = uciToMove(bestMove);
      setEngineHintMove({ from: hintedMove.from, to: hintedMove.to });
      if (request.mode === "magic_hint") {
        setNotice({ tone: "success", text: "Подсказка показана. Вы можете сделать свой ход." });
        return;
      }

      setNotice({ tone: "info", text: "Подсказка показана на доске." });
      return;
    }

    const nextChess = new Chess(request.fen);
    const playedMove = nextChess.move(uciToMove(bestMove));
    if (!playedMove) {
      showEngineError(`Stockfish вернул нелегальный ход: ${moveLabel}.`);
      return;
    }

    const nextFen = nextChess.fen();
    const nextMoveHistory = [...moveHistoryRef.current, playedMove.san + " (Stockfish)"];
    moveHistoryRef.current = nextMoveHistory;
    setFen(nextFen);
    setFenHistory((current) => [...current, nextFen]);
    setMoveHistory(nextMoveHistory);
    setEngineHintMove(null);
    setNotice(getEngineMoveNotice(nextChess, playedMove));
    playAudio(stepAudioRef);

    if (nextChess.isCheckmate()) {
      openDefeatDialog("Мат после хода Stockfish " + playedMove.san + ".");
      return;
    }

    if (nextChess.isDraw()) {
      openDrawDialog(getDrawReason(nextChess, "Stockfish сыграл " + playedMove.san + "."));
      return;
    }

    if (objective.type === "survive_half_moves") {
      const result = evaluateCardObjective(objective, {
        completedHalfMoves: nextMoveHistory.length,
        isCheck: nextChess.isCheck(),
        isCheckmate: false,
      });

      if (result.completed) openObjectiveVictory(result.label);
    }
  }

  useEffect(() => {
    handleBestMoveRef.current = handleBestMove;
  });

  useEffect(() => {
    const worker = new Worker(stockfishWorkerSrc);
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<string>) => {
      const line = String(event.data).trim();
      if (!line) return;

      if (line === "uciok") {
        worker.postMessage("setoption name UCI_LimitStrength value true");
        worker.postMessage(`setoption name UCI_Elo value ${engineDifficulty.uciElo}`);
        worker.postMessage(`setoption name Skill Level value ${engineDifficulty.skillLevel}`);
        worker.postMessage("isready");
        return;
      }

      if (line === "readyok") {
        setEngineStatus((current) => (current === "thinking" ? current : "ready"));
        return;
      }

      if (line.startsWith("bestmove ")) {
        handleBestMoveRef.current(line);
      }
    };

    worker.onerror = () => {
      pendingEngineRequestRef.current = null;
      setEngineStatus("error");
      showEngineError("Ошибка движка Stockfish. Перезагрузите страницу или попробуйте позже.");
    };

    worker.postMessage("uci");

    return () => {
      pendingEngineRequestRef.current = null;
      worker.postMessage("quit");
      worker.terminate();
      workerRef.current = null;
    };
  }, [difficulty, engineDifficulty.skillLevel, engineDifficulty.uciElo, stockfishWorkerSrc]);

  function clearEngineHint(message = "Подсказка скрыта.") {
    setEngineHintMove(null);
    setNotice({ tone: "info", text: message });
  }

  function handleEngineHintButton() {
    if (hasEngineHint) {
      clearEngineHint();
      return;
    }

    requestEngineMove(isPlayerTurn ? "hint" : "apply");
  }

  function requestEngineMove(mode: PendingEngineRequest["mode"], sourceFen = fenRef.current) {
    const worker = workerRef.current;
    if (!worker || engineStatus === "loading" || engineStatus === "error") {
      showEngineError("Stockfish еще не готов или не загрузился.");
      return;
    }

    if (engineStatus === "thinking") {
      setNotice({ tone: "info", text: "Stockfish уже думает над текущей позицией." });
      return;
    }

    const engineChess = new Chess(sourceFen);
    if (engineChess.isGameOver()) {
      setNotice({ tone: "info", text: "Партия уже завершена, движку нечего считать." });
      return;
    }

    startEngineSearch(mode, sourceFen);
  }

  function startEngineSearch(mode: PendingEngineRequest["mode"], sourceFen: string, options: { preserveHint?: boolean } = {}) {
    const worker = workerRef.current;
    if (!worker) {
      showEngineError("Stockfish еще не готов или не загрузился.");
      return;
    }

    pendingEngineRequestRef.current = { fen: sourceFen, mode };
    setEngineStatus("thinking");
    if (!options.preserveHint) setEngineHintMove(null);
    worker.postMessage(`position fen ${sourceFen}`);
    worker.postMessage(`go movetime ${engineDifficulty.moveTimeMs}`);
  }

  async function handleMagicButton(upgrade: MagicUpgradeSpec) {
    if (activeMagic?.id === upgrade.id) {
      setActiveMagic(null);
      setNotice({ tone: "info", text: "Выбор магии отменен." });
      return;
    }

    if (magicPending) return;
    if (!isPlayerTurn) {
      setNotice({ tone: "info", text: "Магию можно использовать только в ход игрока." });
      return;
    }

    if (engineStatus !== "ready") {
      setNotice({ tone: "info", text: "Дождитесь готовности Stockfish перед использованием магии." });
      return;
    }

    if (isGameOver(chess)) {
      setNotice({ tone: "info", text: "Партия уже завершена." });
      return;
    }

    if (availableGold < upgrade.costGold) {
      setNotice({ tone: "error", text: "Не хватает монет для этой магии." });
      return;
    }

    if (upgrade.id === "engine_hint") {
      const paid = await spendMagicGold(upgrade);
      if (!paid) return;

      setActiveMagic(null);
      setSelectedSquare(null);
      requestEngineMove("magic_hint");
      return;
    }

    if (upgrade.target === "own_pawn" && ownPawnSquares.length === 0) {
      setActiveMagic(null);
      setSelectedSquare(null);
      setNotice({ tone: "error", text: "Магию невозможно применить: на доске нет ваших пешек." });
      return;
    }

    setSelectedSquare(null);
    setEngineHintMove(null);
    setActiveMagic(upgrade);
    setNotice({ tone: "info", text: `Выберите свою пешку, чтобы превратить ее в ${upgrade.title.toLowerCase()}.` });
  }

  async function handleMagicTarget(square: FenBoardSquare) {
    const magic = activeMagic;
    if (!magic?.replacementPiece) return;

    if (!isOwnPawnSquare(square, playerTurn)) {
      setNotice({ tone: "error", text: "Эта магия работает только по своим пешкам. Выберите подсвеченную пешку." });
      return;
    }

    const targetSquare = square.square as Square;
    const nextChess = new Chess(fen);
    const removedPiece = nextChess.remove(targetSquare);
    if (!removedPiece || removedPiece.type !== "p" || removedPiece.color !== playerTurn) {
      setNotice({ tone: "error", text: "Не удалось выбрать свою пешку для магии." });
      return;
    }

    const placed = nextChess.put({ color: playerTurn, type: magic.replacementPiece }, targetSquare);
    if (!placed) {
      setNotice({ tone: "error", text: "Не удалось применить магию к этой пешке." });
      return;
    }

    const nextFen = passTurnInFen(nextChess.fen());
    let nextChessAfterMagic: Chess;
    try {
      nextChessAfterMagic = new Chess(nextFen);
    } catch {
      setNotice({ tone: "error", text: "Магия создала некорректную позицию." });
      return;
    }

    const paid = await spendMagicGold(magic);
    if (!paid) return;

    const nextMoveHistory = [...moveHistoryRef.current, `Магия: ${magic.title} на ${targetSquare}`];
    moveHistoryRef.current = nextMoveHistory;
    setFen(nextFen);
    setFenHistory((current) => [...current, nextFen]);
    setMoveHistory(nextMoveHistory);
    setSelectedSquare(null);
    setActiveMagic(null);
    setEngineHintMove(null);
    playAudio(stepAudioRef);

    const objectiveResult = evaluateCardObjective(objective, {
      completedHalfMoves: nextMoveHistory.length,
      capturedPieces: playerCapturedPiecesRef.current,
      isCheck: nextChessAfterMagic.isCheck(),
      isCheckmate: nextChessAfterMagic.isCheckmate(),
    });

    if (objectiveResult.completed) {
      openObjectiveVictory(objectiveResult.label);
      return;
    }

    if (nextChessAfterMagic.isDraw()) {
      openDrawDialog(getDrawReason(nextChessAfterMagic));
      return;
    }

    if (nextChessAfterMagic.isCheckmate()) {
      openObjectiveVictory(`Мат после магии ${magic.title}.`);
      return;
    }

    setNotice({ tone: "success", text: `Пешка превращена в ${magic.title.toLowerCase()}. Ход переходит Stockfish.` });
    startEngineSearch("apply", nextFen);
  }

  async function spendMagicGold(upgrade: MagicUpgradeSpec) {
    setMagicPending(true);
    try {
      const formData = new FormData();
      formData.set("magicId", upgrade.id);
      const result = await spendMagicGoldAction(formData);
      setAvailableGold(result.availableGold);
      if (!result.ok) {
        setNotice({ tone: "error", text: result.error ?? "Не удалось оплатить магию." });
        return false;
      }

      return true;
    } finally {
      setMagicPending(false);
    }
  }

  async function handleSquareClick(square: FenBoardSquare) {
    if (engineStatus === "thinking") {
      setNotice({ tone: "info", text: "Дождитесь хода Stockfish." });
      return;
    }

    if (isGameOver(chess)) {
      setNotice({ tone: "info", text: "Партия уже завершена. Нажмите Сбросить позицию для новой проверки." });
      return;
    }

    if (activeMagic) {
      await handleMagicTarget(square);
      return;
    }

    if (!isPlayerTurn) {
      requestEngineMove("apply");
      setNotice({ tone: "info", text: "Сейчас ход Stockfish. Движок думает над ответом." });
      return;
    }

    const clickedSquare = square.square as Square;
    if (hasEngineHint) setEngineHintMove(null);

    if (!selectedSquare) {
      selectSquare(square);
      return;
    }

    if (selectedSquare === clickedSquare) {
      setSelectedSquare(null);
      setNotice({ tone: "info", text: "Выбор фигуры снят." });
      return;
    }

    const move = legalMoves.find((candidate) => candidate.to === clickedSquare);
    if (!move) {
      if (square.piece && isCurrentTurnPiece(square, chess.turn())) {
        selectSquare(square);
        return;
      }

      setSelectedSquare(null);
      setNotice({ tone: "error", text: "Нелегальный ход отклонен chess.js. Выбор фигуры снят." });
      return;
    }

    const nextChess = new Chess(fen);
    const playedMove = nextChess.move({ from: selectedSquare, to: clickedSquare, promotion: "q" });

    if (!playedMove) {
      setNotice({ tone: "error", text: "Нелегальный ход отклонен chess.js." });
      return;
    }

    const nextFen = nextChess.fen();
    const nextMoveHistory = [...moveHistoryRef.current, playedMove.san];
    const nextPlayerCapturedPieces = playerCapturedPiecesRef.current + (playedMove.captured ? 1 : 0);
    moveHistoryRef.current = nextMoveHistory;
    playerCapturedPiecesRef.current = nextPlayerCapturedPieces;
    setFen(nextFen);
    setFenHistory((current) => [...current, nextFen]);
    setMoveHistory(nextMoveHistory);
    setPlayerCapturedPieces(nextPlayerCapturedPieces);
    setSelectedSquare(null);
    setEngineHintMove(null);
    setNotice(getMoveNotice(nextChess, playedMove));
    playAudio(stepAudioRef);

    const objectiveResult = evaluateCardObjective(objective, {
      capturedPiece: playedMove.captured,
      completedHalfMoves: nextMoveHistory.length,
      capturedPieces: nextPlayerCapturedPieces,
      isCheck: nextChess.isCheck(),
      isCheckmate: nextChess.isCheckmate() && playedMove.color === playerTurn,
    });

    if (objectiveResult.completed) {
      openObjectiveVictory(objectiveResult.label);
      return;
    }

    if (nextChess.isCheckmate() && playedMove.color === playerTurn) {
      openObjectiveVictory(`Мат после ${playedMove.san}.`);
      return;
    }

    if (nextChess.isDraw()) {
      openDrawDialog(getDrawReason(nextChess, "Ход " + playedMove.san + "."));
      return;
    }

    if (!nextChess.isGameOver() && nextChess.turn() !== playerTurn) {
      requestEngineMove("apply", nextFen);
    }
  }

  function selectSquare(square: FenBoardSquare) {
    if (!square.piece) {
      setNotice({ tone: "error", text: "Выберите фигуру, а не пустую клетку." });
      return;
    }

    if (!isCurrentTurnPiece(square, chess.turn())) {
      setNotice({ tone: "error", text: `Сейчас ходят ${turnLabel(chess.turn())}.` });
      return;
    }

    const moves = chess.moves({ square: square.square as Square, verbose: true }) as Move[];
    if (moves.length === 0) {
      setNotice({ tone: "error", text: "У этой фигуры нет легальных ходов." });
      return;
    }

    setSelectedSquare(square.square as Square);
    setNotice({ tone: "info", text: "Фигура выбрана. Доступные ходы отмечены белыми точками." });
  }

  function resetPosition() {
    setFen(initialFen);
    setFenHistory([initialFen]);
    moveHistoryRef.current = [];
    playerCapturedPiecesRef.current = 0;
    setMoveHistory([]);
    setPlayerCapturedPieces(0);
    setSelectedSquare(null);
    setDefeatDialogOpen(false);
    setDrawDialogOpen(false);
    setEngineErrorDialogOpen(false);
    setVictoryDialogOpen(false);
    pendingEngineRequestRef.current = null;
    setEngineStatus((current) => (current === "thinking" ? "ready" : current));
    setEngineHintMove(null);
    setActiveMagic(null);
    setEngineErrorText("Ошибка движка Stockfish.");
    setNotice({ tone: "info", text: `Позиция сброшена. Вы играете за ${sideLabel(playerSide).toLowerCase()}.` });
  }

  function undoMoves(count: number) {
    if (fenHistory.length <= 1) return;

    cancelPendingEngineMove();
    const keepLength = Math.max(1, fenHistory.length - count);
    const nextFenHistory = fenHistory.slice(0, keepLength);
    const nextMoveHistory = moveHistory.slice(0, Math.max(0, moveHistory.length - count));
    const nextCapturedPieces = countPlayerCaptures(nextMoveHistory);
    const nextFen = nextFenHistory[nextFenHistory.length - 1] ?? initialFen;

    moveHistoryRef.current = nextMoveHistory;
    playerCapturedPiecesRef.current = nextCapturedPieces;
    setFen(nextFen);
    setFenHistory(nextFenHistory);
    setMoveHistory(nextMoveHistory);
    setPlayerCapturedPieces(nextCapturedPieces);
    setSelectedSquare(null);
    setEngineHintMove(null);
    setActiveMagic(null);
    setDefeatDialogOpen(false);
    setDrawDialogOpen(false);
    setEngineErrorDialogOpen(false);
    setVictoryDialogOpen(false);
    setNotice({ tone: "info", text: count > 1 ? "Откатили ход игрока и ответ Stockfish." : "Откатили последний полуход." });
  }

  return (
    <>
      <audio ref={stepAudioRef} preload="auto" src={stepSoundSrc} />
      <audio ref={winAudioRef} preload="auto" src={winSoundSrc} />
      <audio ref={defeatAudioRef} preload="auto" src={defeatSoundSrc} />
      <div className="release-battle-shell">
        <div className="game-board-area">
          <ChessBoardView
            ariaLabel={`Шахматная доска: ${cardTitle}`}
            hintFromSquare={engineHintMove?.from ?? null}
            hintToSquare={engineHintMove?.to ?? null}
            legalMoveSquares={highlightedSquares}
            orientation={playerSide}
            selectedSquare={selectedSquare}
            squares={boardSquares}
            onSquareClick={handleSquareClick}
          />
          <div className="board-history-actions" aria-label="Управление ходами">
            <button className="icon-action-button" type="button" disabled={!canUndoFullTurn} onClick={() => undoMoves(2)} aria-label="Назад на ход игрока и ответ Stockfish" title="Назад на ход игрока и ответ Stockfish">
              <Image src={backIconSrc} alt="" width={34} height={34} />
            </button>
            <button className="icon-action-button reset" type="button" onClick={resetPosition} aria-label="Начать заново" title="Начать заново">
              <Image src={resetIconSrc} alt="" width={34} height={34} />
            </button>
          </div>

          <section className="magic-preview" aria-label="Будущая магия">
            <div>
              <h2>Магия</h2>
              <span className="gold-amount">
                В сундуке: {availableGold}
                <Image className="coin-icon" src={coinIconSrc} alt="монеты" width={18} height={18} />
              </span>
            </div>
            <div className="magic-upgrades">
              {MAGIC_UPGRADES.map((upgrade) => {
                const canAfford = upgrade.costGold <= availableGold;
                const canUseMagic = canAfford && isPlayerTurn && engineStatus === "ready" && !isGameOver(chess) && !magicPending;
                const isActiveMagic = activeMagic?.id === upgrade.id;

                return (
                  <button
                    className={`magic-upgrade ${canAfford ? "affordable" : "locked"}${isActiveMagic ? " active" : ""}`}
                    disabled={!canUseMagic && !isActiveMagic}
                    key={`${upgrade.id}-${upgrade.title}`}
                    onClick={() => void handleMagicButton(upgrade)}
                    title={getMagicTooltip(upgrade)}
                    type="button"
                  >
                    {upgrade.replacementPiece ? (
                      <Image className="magic-piece-icon" src={getMagicPieceIconSrc(upgrade, playerSide)} alt={upgrade.title} width={42} height={42} />
                    ) : (
                      <span className="magic-text-label">{upgrade.title}</span>
                    )}
                    <span className="magic-price" aria-label={`Стоимость ${upgrade.costGold} монет`}>
                      <span>{upgrade.costGold}</span>
                      <Image className="coin-icon" src={coinIconSrc} alt="монеты" width={16} height={16} />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <section className="rules-panel" aria-label="Состояние партии">
          <div className={`game-notice ${notice.tone}`} role="status">{notice.text}</div>
          <dl className="battle-summary-strip" aria-label="Ключевые показатели">
            <div>
              <dt>Цель</dt>
              <dd>{objectiveProgress}</dd>
            </div>
            <div>
              <dt>Ход</dt>
              <dd>{turnLabel(chess.turn())}</dd>
            </div>
            <div>
              <dt>Stockfish</dt>
              <dd>{engineStatusLabel(engineStatus)}</dd>
            </div>
          </dl>
          <dl className="rules-stats">
            <div>
              <dt>Карточка</dt>
              <dd>{cardOrder}</dd>
            </div>
            <div>
              <dt>Цель</dt>
              <dd>{objectiveLabel}</dd>
            </div>
            <div>
              <dt>Прогресс цели</dt>
              <dd>{objectiveProgress}</dd>
            </div>
            <div>
              <dt>Шаблон</dt>
              <dd>{templateName}</dd>
            </div>
            <div>
              <dt>Первый ход</dt>
              <dd>{sideToMoveLabel}</dd>
            </div>
            <div>
              <dt>Вы играете</dt>
              <dd>{sideLabel(playerSide)}</dd>
            </div>
            <div>
              <dt>Ход</dt>
              <dd>{turnLabel(chess.turn())}</dd>
            </div>
            <div>
              <dt>Сложность</dt>
              <dd>{difficulty} / 8 · {cardDifficultyLabel}</dd>
            </div>
            <div>
              <dt>Звезды</dt>
              <dd>{cardStars}</dd>
            </div>
            <div>
              <dt>Награда</dt>
              <dd>{rewardScore} очков и {rewardGold} золота</dd>
            </div>
            <div>
              <dt>Состояние</dt>
              <dd>{status}</dd>
            </div>
            <div>
              <dt>Stockfish</dt>
              <dd>{engineStatusLabel(engineStatus)}</dd>
            </div>
            <div>
              <dt>Шах</dt>
              <dd>{chess.isCheck() ? "Да" : "Нет"}</dd>
            </div>
            <div>
              <dt>Настройка движка</dt>
              <dd>Skill {engineDifficulty.skillLevel} / 20 · Elo ~{engineDifficulty.uciElo} · {engineDifficulty.moveTimeMs} мс</dd>
            </div>
          </dl>

          <div className="game-help-icons" aria-label="Справка">
            <button className="help-bubble" type="button" aria-label="Справка о стороне игрока" title="Игрок играет за сторону, чей ход указан в стартовой позиции. Доска повернута к стороне игрока.">?
              <span role="tooltip">Игрок играет за сторону, чей ход указан в стартовой позиции. Доска повернута к стороне игрока.</span>
            </button>
            <button className="help-bubble" type="button" aria-label="Справка о Stockfish" title="Stockfish думает в браузере через Web Worker. После хода игрока движок отвечает автоматически.">?
              <span role="tooltip">Stockfish думает в браузере через Web Worker. После хода игрока движок отвечает автоматически.</span>
            </button>
          </div>

          <div className="move-history">
            <div>
              <h2>История ходов</h2>
            </div>
            {moveHistory.length > 0 ? (
              <ol>
                {moveHistory.map((move, index) => <li key={`${index}-${move}`}>{move}</li>)}
              </ol>
            ) : (
              <p>Ходов пока нет.</p>
            )}
          </div>

          <div className="engine-controls board-engine-controls">
            <div className="engine-actions">
              <button className="ghost-button" type="button" disabled={!canAskEngine} onClick={handleEngineHintButton}>
                {hasEngineHint ? "Скрыть подсказку" : isPlayerTurn ? "Спросить лучший ход" : "Дать ход Stockfish"}
              </button>
              <button className="ghost-button" type="button" disabled={!canAcceptEngineSurrender} onClick={() => acceptEngineSurrender()}>
                Принять сдачу движка
              </button>
            </div>
          </div>
        </section>
      </div>

      {engineErrorDialogOpen ? (
        <dialog className="battle-dialog victory-dialog engine-error-dialog" open aria-labelledby="engine-error-dialog-title">
          <div className="battle-dialog-header">
            <div>
              <p className="eyebrow">Ошибка движка</p>
              <h2 id="engine-error-dialog-title">Stockfish не смог продолжить</h2>
            </div>
          </div>
          <div className="victory-dialog-body">
            <p className="engine-error-reason">{engineErrorText}</p>
            <p>Награда не начислена. Можно вернуться к позиции, начать заново или уйти на карту.</p>
          </div>
          <div className="dialog-actions engine-error-actions">
            <button className="ghost-button" type="button" onClick={() => setEngineErrorDialogOpen(false)}>К партии</button>
            <button className="ghost-button" type="button" onClick={resetPosition}>Сначала</button>
            <Link className="primary-action" href="/map">На карту</Link>
          </div>
        </dialog>
      ) : null}

      {defeatDialogOpen ? (
        <dialog className="battle-dialog victory-dialog defeat-dialog" open aria-labelledby="defeat-dialog-title">
          <div className="victory-art defeat-art">
            <Image src={defeatedHeroImageSrc} alt="" width={520} height={220} priority />
          </div>
          <div className="battle-dialog-header">
            <div>
              <p className="eyebrow">Поражение</p>
              <h2 id="defeat-dialog-title">Герой повержен</h2>
            </div>
          </div>
          <div className="victory-dialog-body">
            <p className="defeat-reason">{defeatReason}</p>
            <p>Можно вернуться на карту или начать эту битву сначала.</p>
          </div>
          <div className="dialog-actions victory-dialog-actions">
            <button className="ghost-button" type="button" onClick={() => setDefeatDialogOpen(false)}>К доске</button>
            <Link className="ghost-button" href="/map">Вернуться на карту</Link>
            <button type="button" onClick={resetPosition}>Начать сначала</button>
          </div>
        </dialog>
      ) : null}

      {drawDialogOpen ? (
        <dialog className="battle-dialog victory-dialog draw-dialog" open aria-labelledby="draw-dialog-title">
          <div className="battle-dialog-header">
            <div>
              <p className="eyebrow">Ничья</p>
              <h2 id="draw-dialog-title">Партия завершена</h2>
            </div>
          </div>
          <div className="victory-dialog-body">
            <p className="draw-reason">{drawReason}</p>
            <p>Можно посмотреть финальную позицию, начать эту битву сначала или вернуться на карту.</p>
          </div>
          <div className="dialog-actions victory-dialog-actions">
            <button className="ghost-button" type="button" onClick={() => setDrawDialogOpen(false)}>К доске</button>
            <button className="ghost-button" type="button" onClick={resetPosition}>Начать сначала</button>
            <Link className="primary-action" href="/map">На карту</Link>
          </div>
        </dialog>
      ) : null}

      {victoryDialogOpen ? (
        <dialog className="battle-dialog victory-dialog" open aria-labelledby="victory-dialog-title">
          <div className="victory-art">
            <Image src={defeatedEnemyImageSrc} alt="" width={520} height={220} priority />
          </div>
          <div className="battle-dialog-header">
            <div>
              <p className="eyebrow">Победа</p>
              <h2 id="victory-dialog-title">Противник повержен</h2>
            </div>
          </div>
          <div className="victory-dialog-body">
            <p className="victory-reason">{victoryReason}</p>
            <p>{congratulationsText}</p>
            <dl className="dialog-stats">
              <div>
                <dt>Награда</dt>
                <dd>{rewardScore} очков и {rewardGold} золота</dd>
              </div>
              <div>
                <dt>Карточка</dt>
                <dd>{cardTitle}</dd>
              </div>
            </dl>
          </div>
          <form className="dialog-actions victory-dialog-actions" action={completeCardAction}>
            <input name="cardSlug" type="hidden" value={cardSlug} />
            <button className="ghost-button" type="button" onClick={() => setVictoryDialogOpen(false)}>Вернуться к партии</button>
            <button type="submit">Вернуться и получить награды</button>
          </form>
        </dialog>
      ) : null}
    </>
  );
}

function getMagicPieceIconSrc(upgrade: MagicUpgradeSpec, playerSide: PlayerSide) {
  const color = playerSide === "white" ? "white" : "black";
  if (upgrade.replacementPiece === "b") return publicPath(`/pieces/${color}-bishop.png`);
  if (upgrade.replacementPiece === "n") return publicPath(`/pieces/${color}-knight.png`);
  if (upgrade.replacementPiece === "r") return publicPath(`/pieces/${color}-rook.png`);
  if (upgrade.replacementPiece === "q") return publicPath(`/pieces/${color}-queen.png`);
  return publicPath(`/pieces/${color}-pawn.png`);
}

function countPlayerCaptures(moveHistory: string[]) {
  return moveHistory.filter((move) => !move.includes("(Stockfish)") && move.includes("x")).length;
}

function playAudio(audioRef: React.RefObject<HTMLAudioElement | null>) {
  const audio = audioRef.current;
  if (!audio) return;

  audio.currentTime = 0;
  void audio.play().catch(() => undefined);
}

function getOwnPawnSquares(squares: FenBoardSquare[], playerTurn: "w" | "b") {
  return squares.filter((square) => isOwnPawnSquare(square, playerTurn)).map((square) => square.square);
}

function isOwnPawnSquare(square: FenBoardSquare, playerTurn: "w" | "b") {
  const ownPawn = playerTurn === "w" ? "P" : "p";
  return square.piece?.code === ownPawn;
}

function passTurnInFen(fen: string) {
  const parts = fen.trim().split(/\s+/);
  const activeTurn = parts[1] === "b" ? "b" : "w";
  parts[1] = activeTurn === "w" ? "b" : "w";
  parts[3] = "-";
  parts[4] = String((Number.parseInt(parts[4] ?? "0", 10) || 0) + 1);
  if (activeTurn === "b") {
    parts[5] = String((Number.parseInt(parts[5] ?? "1", 10) || 1) + 1);
  }

  return parts.join(" ");
}

function getMagicTooltip(upgrade: MagicUpgradeSpec) {
  if (upgrade.replacementPiece === "b") return "Обращает пешку в слона";
  if (upgrade.replacementPiece === "n") return "Обращает пешку в коня";
  if (upgrade.replacementPiece === "r") return "Обращает пешку в ладью";
  if (upgrade.replacementPiece === "q") return "Обращает пешку в ферзя";
  return upgrade.summary;
}

function isCurrentTurnPiece(square: FenBoardSquare, turn: "w" | "b") {
  if (!square.piece) return false;
  return turn === "w" ? square.piece.code === square.piece.code.toUpperCase() : square.piece.code === square.piece.code.toLowerCase();
}

function getGameStatus(chess: Chess) {
  if (chess.isCheckmate()) return `Мат. Победа ${winnerLabel(chess.turn())}.`;
  if (chess.isStalemate()) return "Пат. Ничья.";
  if (chess.isInsufficientMaterial()) return "Ничья: недостаточно материала.";
  if (chess.isThreefoldRepetition()) return "Ничья: троекратное повторение.";
  if (chess.isDraw()) return "Ничья.";
  if (chess.isCheck()) return `Шах. Ходят ${turnLabel(chess.turn())}.`;
  return "Партия идет.";
}

function getMoveNotice(chess: Chess, move: Move): GameNotice {
  if (chess.isCheckmate()) {
    return { tone: "success", text: `Мат после ${move.san}. Победа ${winnerLabel(chess.turn())}.` };
  }

  if (chess.isDraw()) {
    return { tone: "info", text: `Ход ${move.san}. Партия завершилась вничью.` };
  }

  if (chess.isCheck()) {
    return { tone: "success", text: `Ход ${move.san}. Шах.` };
  }

  return { tone: "success", text: `Ход ${move.san} выполнен.` };
}

function getEngineMoveNotice(chess: Chess, move: Move): GameNotice {
  if (chess.isCheckmate()) return { tone: "error", text: `Stockfish сыграл ${move.san}. Мат игроку.` };
  if (chess.isDraw()) return { tone: "info", text: `Stockfish сыграл ${move.san}. Партия завершилась вничью.` };
  if (chess.isCheck()) return { tone: "success", text: `Stockfish сыграл ${move.san}. Шах.` };
  return { tone: "success", text: `Stockfish сыграл ${move.san}. Ваш ход.` };
}

function isGameOver(chess: Chess) {
  return chess.isGameOver();
}

function turnLabel(turn: "w" | "b") {
  return turn === "w" ? "Белые" : "Черные";
}

function winnerLabel(nextTurn: "w" | "b") {
  return nextTurn === "w" ? "черных" : "белых";
}

function playerSideToTurn(side: PlayerSide) {
  return side === "white" ? "w" : "b";
}

function sideLabel(side: PlayerSide) {
  return side === "white" ? "Белых" : "Черных";
}

function engineStatusLabel(status: EngineStatus) {
  if (status === "loading") return "Загрузка";
  if (status === "thinking") return "Думает";
  if (status === "error") return "Ошибка";
  return "Готов";
}

function isNoEngineMove(bestMove: string) {
  return !bestMove || bestMove === "(none)" || bestMove === "0000";
}

function getDrawReason(chess: Chess, prefix?: string) {
  const intro = prefix ? `${prefix} ` : "";
  if (chess.isStalemate()) return `${intro}Пат. Партия завершилась вничью.`;
  if (chess.isInsufficientMaterial()) return `${intro}Ничья: недостаточно материала.`;
  if (chess.isThreefoldRepetition()) return `${intro}Ничья: троекратное повторение.`;
  return `${intro}Партия завершилась вничью.`;
}

function uciToMove(uciMove: string) {
  return {
    from: uciMove.slice(0, 2) as Square,
    to: uciMove.slice(2, 4) as Square,
    promotion: uciMove.slice(4, 5) || "q",
  };
}

function formatUciMove(uciMove: string) {
  const promotion = uciMove.slice(4, 5);
  return promotion ? `${uciMove.slice(0, 2)}-${uciMove.slice(2, 4)}=${promotion.toUpperCase()}` : `${uciMove.slice(0, 2)}-${uciMove.slice(2, 4)}`;
}
