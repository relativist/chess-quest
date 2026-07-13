import { redirect } from "next/navigation";
import { OnlineChessGameClient } from "@/components/online-chess-game-client";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuthenticatedHomePath, getLoginPath } from "@/lib/routing/auth-redirect";
import { publicPath } from "@/lib/routing/public-path";
import styles from "./online-game.module.css";

type OnlineGamePageProps = {
  params: Promise<{ matchId: string }>;
};

export default async function OnlineGamePage({ params }: OnlineGamePageProps) {
  const user = await getCurrentUser();
  if (!user) redirect(getLoginPath("Зарегистрируйтесь или войдите, чтобы играть."));
  if (user.role === "MAP_EDITOR") redirect(getAuthenticatedHomePath(user));

  const { matchId } = await params;
  const stageBackground = publicPath("/assets/images/backgrounds/main-wall.png");

  return (
    <section
      className={`battle-stage-page ${styles.page}`}
      style={{ "--stage-background": `url(${stageBackground})` } as React.CSSProperties}
    >
      <OnlineChessGameClient key={matchId} matchId={matchId} />
    </section>
  );
}
