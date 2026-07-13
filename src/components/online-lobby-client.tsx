"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { OnlineLobbySnapshot } from "@/lib/online/types";
import { publicPath } from "@/lib/routing/public-path";
import styles from "@/app/online/online.module.css";

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

export function OnlineLobbyClient() {
  const router = useRouter();
  const mountedRef = useRef(true);
  const refreshPendingRef = useRef(false);
  const challengeDialogRef = useRef<HTMLDialogElement>(null);
  const [snapshot, setSnapshot] = useState<OnlineLobbySnapshot | null>(null);
  const [error, setError] = useState("");
  const [actionPending, setActionPending] = useState("");

  const refreshLobby = useCallback(async () => {
    if (refreshPendingRef.current) return;
    refreshPendingRef.current = true;

    try {
      const data = await onlineRequest<{ snapshot: OnlineLobbySnapshot }>(
        publicPath("/api/online/lobby"),
        "POST",
        {},
      );
      if (!mountedRef.current) return;
      setSnapshot(data.snapshot);
      setError("");
      if (data.snapshot.activeMatchId) {
        router.replace(`/online/game/${data.snapshot.activeMatchId}`);
      }
    } catch (requestError) {
      if (mountedRef.current) setError(errorMessage(requestError));
    } finally {
      refreshPendingRef.current = false;
    }
  }, [router]);

  useEffect(() => {
    mountedRef.current = true;
    const initialTimer = window.setTimeout(() => void refreshLobby(), 0);
    const timer = window.setInterval(() => void refreshLobby(), 3_000);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [refreshLobby]);

  async function createChallenge(challengedId: string) {
    await runAction(`create:${challengedId}`, async () => {
      await onlineRequest(publicPath("/api/online/challenges"), "POST", { challengedId });
      await refreshLobby();
    });
  }

  async function transitionChallenge(
    challengeId: string,
    action: "accept" | "decline" | "cancel",
  ) {
    await runAction(`${action}:${challengeId}`, async () => {
      const data = await onlineRequest<{ match?: { id: string } }>(
        publicPath(`/api/online/challenges/${encodeURIComponent(challengeId)}`),
        "PATCH",
        { action },
      );
      if (action === "accept" && data.match?.id) {
        router.replace(`/online/game/${data.match.id}`);
        return;
      }
      await refreshLobby();
    });
  }

  async function runAction(key: string, operation: () => Promise<void>) {
    if (actionPending) return;
    setActionPending(key);
    setError("");

    try {
      await operation();
    } catch (requestError) {
      if (mountedRef.current) setError(errorMessage(requestError));
    } finally {
      if (mountedRef.current) setActionPending("");
    }
  }

  const incomingChallenge = snapshot?.incomingChallenges[0] ?? null;
  useEffect(() => {
    const dialog = challengeDialogRef.current;
    if (!dialog) return;
    if (incomingChallenge && !dialog.open) dialog.showModal();
    if (!incomingChallenge && dialog.open) dialog.close();
  }, [incomingChallenge]);

  const challengedPlayerIds = new Set(
    snapshot?.outgoingChallenges.map((challenge) => challenge.player.id) ?? [],
  );

  return (
    <div className={styles.lobby}>
      {error ? (
        <div className={styles.errorBanner} role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void refreshLobby()}>
            Повторить
          </button>
        </div>
      ) : null}

      <section className={styles.playersSection} aria-labelledby="online-players-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">Игроки в сети</p>
            <h2 id="online-players-title">Выберите соперника</h2>
          </div>
          <span
            className={styles.onlineCount}
            aria-label={snapshot ? "Игроков онлайн: " + snapshot.players.length : "Список игроков загружается"}
          >
            {snapshot ? snapshot.players.length : "…"}
          </span>
        </div>

        {!snapshot ? (
          <p className={styles.emptyState}>Ищем игроков на странице онлайн…</p>
        ) : snapshot.players.length === 0 ? (
          <p className={styles.emptyState}>
            Пока здесь никого нет. Список обновляется автоматически.
          </p>
        ) : (
          <div className={styles.playersList}>
            {snapshot.players.map((player) => {
              const alreadyChallenged = challengedPlayerIds.has(player.id);
              const pending = actionPending === `create:${player.id}`;

              return (
                <article className={styles.playerRow} key={player.id}>
                  <div className={styles.playerIdentity}>
                    <span className={styles.playerAvatar} aria-hidden="true">
                      {player.name.slice(0, 1).toLocaleUpperCase("ru")}
                    </span>
                    <div>
                      <h3>{player.name}</h3>
                      <p>Рейтинг: <strong>{player.onlineRating}</strong></p>
                    </div>
                  </div>
                  <button
                    className="primary-action"
                    disabled={Boolean(actionPending) || alreadyChallenged}
                    type="button"
                    onClick={() => void createChallenge(player.id)}
                  >
                    {pending
                      ? "Отправляем…"
                      : alreadyChallenged
                        ? "Вызов отправлен"
                        : "Предложить битву"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {snapshot?.outgoingChallenges.length ? (
        <section className={styles.challengesSection} aria-labelledby="outgoing-title">
          <h2 id="outgoing-title">Отправленные вызовы</h2>
          <div className={styles.challengeList}>
            {snapshot.outgoingChallenges.map((challenge) => (
              <article className={styles.challengeRow} key={challenge.id}>
                <div>
                  <strong>{challenge.player.name}</strong>
                  <span>Рейтинг: {challenge.player.onlineRating}</span>
                </div>
                <button
                  className="ghost-button"
                  disabled={Boolean(actionPending)}
                  type="button"
                  onClick={() => void transitionChallenge(challenge.id, "cancel")}
                >
                  {actionPending === `cancel:${challenge.id}` ? "Отменяем…" : "Отменить"}
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className={`solo-settings-actions ${styles.footerActions}`}>
        <Link
          className="ghost-button solo-back-button"
          href="/start"
        >
          <Image src={publicPath("/assets/images/icons/back.png")} alt="" width={42} height={42} />
          <span>Назад к выбору</span>
        </Link>
      </div>

      {incomingChallenge ? (
        <dialog
          className={styles.challengeDialog}
          ref={challengeDialogRef}
          onCancel={(event) => event.preventDefault()}
          aria-labelledby="incoming-challenge-title"
        >
          <p className="eyebrow">Вызов на битву</p>
          <h2 id="incoming-challenge-title">
            {incomingChallenge.player.name} предлагает сыграть
          </h2>
          <p>
            Рейтинг соперника: <strong>{incomingChallenge.player.onlineRating}</strong>
          </p>
          {snapshot && snapshot.incomingChallenges.length > 1 ? (
            <p className={styles.moreChallenges}>
              Ещё вызовов: {snapshot.incomingChallenges.length - 1}
            </p>
          ) : null}
          <div className={styles.dialogActions}>
            <button
              className={`ghost-button ${styles.dialogActionButton}`}
              disabled={Boolean(actionPending)}
              type="button"
              onClick={() => void transitionChallenge(incomingChallenge.id, "decline")}
            >
              <Image className={styles.dialogActionIcon} src={publicPath("/assets/images/icons/reject.png")} alt="" width={56} height={56} />
              <span>
                {actionPending === `decline:${incomingChallenge.id}`
                  ? "Отклоняем…"
                  : "Отклонить"}
              </span>
            </button>
            <button
              className={`primary-action ${styles.dialogActionButton}`}
              disabled={Boolean(actionPending)}
              type="button"
              onClick={() => void transitionChallenge(incomingChallenge.id, "accept")}
            >
              <Image className={styles.dialogActionIcon} src={publicPath("/assets/images/icons/ok.png")} alt="" width={56} height={56} />
              <span>
                {actionPending === `accept:${incomingChallenge.id}`
                  ? "Начинаем…"
                  : "Принять"}
              </span>
            </button>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}

async function onlineRequest<T = unknown>(
  url: string,
  method: "POST" | "PATCH",
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method,
  });

  let data: T & ApiErrorBody;
  try {
    data = await response.json() as T & ApiErrorBody;
  } catch {
    throw new Error("Сервер онлайн-режима вернул некорректный ответ.");
  }

  if (!response.ok) {
    throw new Error(data.error?.message || "Не удалось выполнить действие.");
  }

  return data;
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Не удалось связаться с онлайн-режимом.";
}
