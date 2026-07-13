"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { logoutAction } from "@/app/auth/actions";
import { UsersLeaderboardModal } from "@/components/users-leaderboard-modal";
import type { LeaderboardUser } from "@/lib/quest/leaderboard";

type HeaderUser = {
  id: string;
  displayName: string;
  role: "PLAYER" | "MAP_EDITOR";
};

type HeaderPlayerSummary = {
  completedCards: number;
  playerGold: number;
  totalCards: number;
  totalWins: number;
};

type HeaderIcons = {
  cards: string;
  coin: string;
  exit: string;
  map: string;
  online: string;
  user: string;
  users: string;
  victories: string;
};

type AppHeaderProps = {
  buildInfo: {
    date: string;
    version: string;
  };
  faviconSrc: string;
  icons: HeaderIcons;
  leaderboardUsers: LeaderboardUser[];
  logout: typeof logoutAction;
  playerSummary: HeaderPlayerSummary | null;
  user: HeaderUser | null;
};

export function AppHeader(props: AppHeaderProps) {
  const pathname = usePathname();

  return <AppHeaderForPath key={pathname} {...props} pathname={pathname} />;
}

function AppHeaderForPath({ buildInfo, faviconSrc, icons, leaderboardUsers, logout, pathname, playerSummary, user }: AppHeaderProps & { pathname: string }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (pathname === "/auth") return null;

  function closeMenu() {
    setIsMenuOpen(false);
  }

  return (
    <>
      <button
        className={isMenuOpen ? "app-menu-toggle open" : "app-menu-toggle"}
        type="button"
        aria-label={isMenuOpen ? "Закрыть меню" : "Открыть меню"}
        aria-expanded={isMenuOpen}
        aria-controls="app-side-menu"
        onClick={() => setIsMenuOpen((current) => !current)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      {isMenuOpen ? <button className="app-menu-backdrop" type="button" aria-label="Закрыть меню" onClick={closeMenu} /> : null}

      <aside className={isMenuOpen ? "app-side-menu open" : "app-side-menu"} id="app-side-menu" aria-label="Меню приложения" aria-hidden={!isMenuOpen}>
        <Link className="brand" href="/map" aria-label="Chess Quest map" onClick={closeMenu}>
          <span className="brand-mark" aria-hidden="true">
            <Image src={faviconSrc} alt="" width={32} height={32} priority />
          </span>
          <span className="brand-copy">
            <span>Chess Quest</span>
            <span className="brand-build">v{buildInfo.version} · {buildInfo.date}</span>
          </span>
        </Link>

        {user && playerSummary && !pathname.startsWith("/solo") ? (
          <div className="header-player-panel" aria-label="Параметры игрока">
            <dl className="header-player-stats">
              <div>
                <dt><Image className="header-stat-icon" src={icons.coin} alt="" width={18} height={18} />Золото</dt>
                <dd>{playerSummary.playerGold}</dd>
              </div>
              <div>
                <dt><Image className="header-stat-icon" src={icons.victories} alt="" width={18} height={18} />Победы</dt>
                <dd>{playerSummary.totalWins}</dd>
              </div>
              <div>
                <dt><Image className="header-stat-icon" src={icons.cards} alt="" width={18} height={18} />Карточки</dt>
                <dd>{playerSummary.completedCards} / {playerSummary.totalCards}</dd>
              </div>
            </dl>
          </div>
        ) : null}

        <nav className="top-nav" aria-label="Main navigation">
          {user ? (
            <span className="user-pill"><Image className="nav-icon" src={icons.user} alt="" width={24} height={24} />{user.displayName}</span>
          ) : (
            <Link href="/auth" onClick={closeMenu}>Вход</Link>
          )}
          {user && playerSummary ? <UsersLeaderboardModal currentUserId={user.id} users={leaderboardUsers} usersIconSrc={icons.users} /> : null}
          {user?.role === "PLAYER" ? (
            <>
              <Link href="/map" onClick={closeMenu}><Image className="nav-icon" src={icons.map} alt="" width={24} height={24} />Кампания</Link>
              <Link href="/solo" onClick={closeMenu}><Image className="nav-icon" src={icons.user} alt="" width={24} height={24} />Соло</Link>
              <Link href="/online" onClick={closeMenu}><Image className="nav-icon" src={icons.online} alt="" width={24} height={24} />Онлайн</Link>
            </>
          ) : null}
          {user?.role === "MAP_EDITOR" ? <Link href="/map/editor" onClick={closeMenu}><Image className="nav-icon" src={icons.cards} alt="" width={24} height={24} />Редактор</Link> : null}
          {user ? (
            <form action={logout}>
              <button className="nav-button" type="submit"><Image className="nav-icon" src={icons.exit} alt="" width={24} height={24} />Выход</button>
            </form>
          ) : null}
        </nav>
      </aside>
    </>
  );
}
