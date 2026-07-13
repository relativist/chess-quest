import Image from "next/image";
import { redirect } from "next/navigation";
import { SoloSettingsForm } from "@/components/solo-settings-form";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuthenticatedHomePath, getLoginPath } from "@/lib/routing/auth-redirect";
import { publicPath } from "@/lib/routing/public-path";
import { parseSoloGameSettings, type SoloSettingsSearchParams } from "@/lib/solo/solo-game-settings";

type SoloPageProps = {
  searchParams: Promise<SoloSettingsSearchParams>;
};

export default async function SoloPage({ searchParams }: SoloPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect(getLoginPath("Зарегистрируйтесь или войдите, чтобы играть."));
  if (user.role === "MAP_EDITOR") redirect(getAuthenticatedHomePath(user));

  const settings = parseSoloGameSettings(await searchParams);
  const stageBackground = publicPath("/assets/images/backgrounds/main-wall.png");

  return (
    <section className="solo-page auth-background-page" style={{ "--auth-background": "url(" + stageBackground + ")" } as React.CSSProperties}>
      <div className="solo-settings-panel">
        <header className="solo-settings-heading">
          <Image src={publicPath("/assets/images/icons/user.png")} alt="" width={82} height={82} priority />
          <div>
            <h1>Одиночный поединок</h1>
            <p>Сразитесь со Stockfish на своих условиях. Результат не влияет на рейтинг и сундук кампании.</p>
          </div>
        </header>
        <SoloSettingsForm
          backIconSrc={publicPath("/assets/images/icons/back.png")}
          battleIconSrc={publicPath("/assets/images/icons/battle.png")}
          initialSettings={settings}
        />
      </div>
    </section>
  );
}
