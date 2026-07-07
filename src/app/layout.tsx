import type {Metadata} from "next";
import {logoutAction} from "@/app/auth/actions";
import {AppHeader} from "@/components/app-header";
import {getUsersLeaderboard} from "@/lib/quest/leaderboard";
import {getCurrentQuestMap} from "@/lib/quest/quest-data";
import {getCurrentUser} from "@/lib/auth/session";
import {getBasePath, publicPath} from "@/lib/routing/public-path";
import packageJson from "../../package.json";
import "./globals.css";

const buildDate = (process.env.NEXT_PUBLIC_BUILD_DATE || process.env.BUILD_DATE || new Date().toISOString()).slice(0, 10);
const buildInfo = { date: buildDate, version: packageJson.version };

export const metadata: Metadata = {
  title: "Chess Quest",
  description: "A chess quest game with map battles and position templates.",
  icons: {
    icon: `${getBasePath()}/favicon.png`,
    shortcut: `${getBasePath()}/favicon.png`,
    apple: `${getBasePath()}/favicon.png`,
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
      <body>
        <AppHeader buildInfo={buildInfo} faviconSrc={publicPath("/favicon.png")} leaderboardUsers={headerLeaderboardUsers} logout={logoutAction} playerSummary={playerSummary} user={user} />
        <main>{children}</main>
      </body>
    </html>
  );
}
