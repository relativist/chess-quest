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
import "./game-modes.css";

const buildDate = (process.env.NEXT_PUBLIC_BUILD_DATE || process.env.BUILD_DATE || new Date().toISOString()).slice(0, 10);
const buildInfo = { date: buildDate, version: packageJson.version };
const cheyenneFont = localFont({
  src: "../../assets/fonts/cheyenne-infanity/CheyenneSans-Regular.ttf",
  variable: "--font-cheyenne",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Chess Quest",
  description: "A chess quest game with map battles and position templates.",
  icons: {
    icon: `${getBasePath()}/assets/images/branding/favicon.png`,
    shortcut: `${getBasePath()}/assets/images/branding/favicon.png`,
    apple: `${getBasePath()}/assets/images/branding/favicon.png`,
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
        <ButtonClickSound soundSrc={publicPath("/assets/audio/sfx/click.mp3")} />
        <AppHeader
          buildInfo={buildInfo}
          faviconSrc={publicPath("/assets/images/branding/logo.png")}
          icons={{
            cards: publicPath("/assets/images/icons/cards.png"),
            coin: publicPath("/assets/images/icons/coin.png"),
            exit: publicPath("/assets/images/icons/exit.png"),
            map: publicPath("/assets/images/icons/map.png"),
            online: publicPath("/assets/images/icons/online.png"),
            user: publicPath("/assets/images/icons/user.png"),
            users: publicPath("/assets/images/icons/users.png"),
            victories: publicPath("/assets/images/icons/victories.png"),
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
