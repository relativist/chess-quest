import Image from "next/image";
import { redirect } from "next/navigation";
import { OnlineLobbyClient } from "@/components/online-lobby-client";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuthenticatedHomePath, getLoginPath } from "@/lib/routing/auth-redirect";
import { publicPath } from "@/lib/routing/public-path";
import styles from "./online.module.css";

export default async function OnlinePage() {
  const user = await getCurrentUser();
  if (!user) redirect(getLoginPath("Зарегистрируйтесь или войдите, чтобы играть."));
  if (user.role === "MAP_EDITOR") redirect(getAuthenticatedHomePath(user));

  const stageBackground = publicPath("/assets/images/backgrounds/main-wall.png");

  return (
    <section
      className={`online-page auth-background-page ${styles.page}`}
      style={{ "--auth-background": `url(${stageBackground})` } as React.CSSProperties}
    >
      <div className={styles.panel}>
        <header className={styles.hero}>
          <Image
            src={publicPath("/assets/images/icons/online.png")}
            alt=""
            width={112}
            height={112}
            priority
          />
          <div>
            <p className="eyebrow">Режим онлайн</p>
            <h1>Игроки готовы к битве</h1>
            <p>
              Выберите соперника и отправьте вызов. Цвет фигур назначится случайно,
              когда соперник примет предложение.
            </p>
          </div>
        </header>

        <OnlineLobbyClient />
      </div>
    </section>
  );
}
