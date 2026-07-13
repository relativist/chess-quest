import { redirect } from "next/navigation";
import { GameModeDialog } from "@/components/game-mode-dialog";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuthenticatedHomePath, getLoginPath } from "@/lib/routing/auth-redirect";
import { publicPath } from "@/lib/routing/public-path";

export default async function StartPage() {
  const user = await getCurrentUser();
  if (!user) redirect(getLoginPath("Зарегистрируйтесь или войдите, чтобы играть."));
  if (user.role === "MAP_EDITOR") redirect(getAuthenticatedHomePath(user));

  const background = publicPath("/assets/images/backgrounds/editor.png");

  return (
    <section className="start-page" style={{ "--start-background": "url(" + background + ")" } as React.CSSProperties}>
      <GameModeDialog
        icons={{
          campaign: publicPath("/assets/images/icons/map.png"),
          online: publicPath("/assets/images/icons/online.png"),
          solo: publicPath("/assets/images/icons/user.png"),
        }}
      />
    </section>
  );
}
