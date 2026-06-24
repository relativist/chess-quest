"use client";

import { useId, useRef } from "react";
import type { LeaderboardUser } from "@/lib/quest/leaderboard";

type UsersLeaderboardModalProps = {
  currentUserId?: string;
  users: LeaderboardUser[];
};

export function UsersLeaderboardModal({ currentUserId, users }: UsersLeaderboardModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  function openDialog() {
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button className="ghost-button" type="button" onClick={openDialog}>Пользователи</button>
      <dialog className="battle-dialog leaderboard-dialog" ref={dialogRef} aria-labelledby={titleId}>
        <div className="battle-dialog-header">
          <div>
            <p className="eyebrow">Рейтинг</p>
            <h2 id={titleId}>Пользователи</h2>
          </div>
          <button className="dialog-close" type="button" aria-label="Закрыть" onClick={closeDialog}>×</button>
        </div>

        {users.length > 0 ? (
          <div className="leaderboard-list">
            {users.map((user) => {
              const isCurrentUser = user.id === currentUserId;

              return (
                <article className={`leaderboard-row ${isCurrentUser ? "current-user" : ""}`} key={user.id} aria-current={isCurrentUser ? "true" : undefined}>
                  <div className="leaderboard-rank">#{user.rank}</div>
                <div className="leaderboard-player">
                  <strong>{user.displayName}{isCurrentUser ? <span className="current-user-badge">Вы</span> : null}</strong>
                  <span>{user.login}</span>
                </div>
                <dl>
                  <div>
                    <dt>Очки</dt>
                    <dd>{user.earnedScore}</dd>
                  </div>
                  <div>
                    <dt>Золото</dt>
                    <dd>{user.earnedGold}</dd>
                  </div>
                  <div>
                    <dt>Победы</dt>
                    <dd>{user.wins}</dd>
                  </div>
                  <div>
                    <dt>Карты</dt>
                    <dd>{user.completedCards}</dd>
                  </div>
                </dl>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="dialog-goal">Игроков пока нет.</p>
        )}

        <div className="dialog-actions">
          <button className="ghost-button" type="button" onClick={closeDialog}>Закрыть</button>
        </div>
      </dialog>
    </>
  );
}
