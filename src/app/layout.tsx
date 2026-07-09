import type {Metadata} from "next";
import localFont from "next/font/local";
import {logoutAction} from "@/app/auth/actions";
import {AppHeader} from "@/components/app-header";
import {ButtonClickSound} from "@/components/button-click-sound";
import {getUsersLeaderboard} from "@/lib/quest/leaderboard";
import {getCurrentQuestMap} from "@/lib/quest/quest-data";
import {getCurrentUser} from "@/lib/auth/session";
import {getBasePath, publicPath} from "@/lib/routing/public-path";
import packageJson from "../../package.json";
import "./globals.css";

const buildDate = (process.env.NEXT_PUBLIC_BUILD_DATE || process.env.BUILD_DATE || new Date().toISOString()).slice(0, 10);
const buildInfo = { date: buildDate, version: packageJson.version };
const cheyenneFont = localFont({
  src: "../../wall/Cheyenne Infanity/CheyenneSans-Regular.ttf",
  variable: "--font-cheyenne",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Chess Quest",
  description: "A chess quest game with map battles and position templates.",
  icons: {
    icon: `${getBasePath()}/wall/1/favicon.png`,
    shortcut: `${getBasePath()}/wall/1/favicon.png`,
    apple: `${getBasePath()}/wall/1/favicon.png`,
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  const [headerMap, headerLeaderboardUsers] = user?.role === "PLAYER"
    ? await Promise.all([getCurrentQuestMap(user.id), getUsersLeaderboard()])
    : [null, []];
  const playerSummary = headerMap
    ? {
        completedCards: headerMap.completedCards,
        playerGold: headerMap.playerGold,
        totalCards: headerMap.cards.length,
        totalWins: headerMap.totalWins,
      }
    : null;

  return (
    <html lang="ru">
      <body className={cheyenneFont.variable}>
        <ButtonClickSound soundSrc={publicPath("/wall/click.mp3")} />
        <AppHeader
          buildInfo={buildInfo}
          faviconSrc={publicPath("/wall/1/logo.png")}
          icons={{
            cards: publicPath("/wall/1/cards.png"),
            coin: publicPath("/wall/1/coin.png"),
            exit: publicPath("/wall/1/exit.png"),
            map: publicPath("/wall/1/map.png"),
            user: publicPath("/wall/1/user.png"),
            users: publicPath("/wall/1/users.png"),
            victories: publicPath("/wall/1/victories.png"),
          }}
          leaderboardUsers={headerLeaderboardUsers}
          logout={logoutAction}
          playerSummary={playerSummary}
          user={user}
        />
        <main>{children}</main>
      </body>
    </html>
  );
}
