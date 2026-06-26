import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { demoMapEditorLoginAction, loginAction, registerAction } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuthenticatedHomePath } from "@/lib/routing/auth-redirect";
import { publicPath } from "@/lib/routing/public-path";

type AuthPageProps = {
  searchParams: Promise<{ error?: string; mode?: string }>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const user = await getCurrentUser();
  if (user) redirect(publicPath(getAuthenticatedHomePath(user)));

  const params = await searchParams;
  const mode = params.mode === "register" ? "register" : "login";
  const error = params.error ? decodeURIComponent(params.error) : "";
  const authBackground = publicPath("/wall/game_wall.png");

  return (
    <section className="auth-shell auth-background-page" style={{ "--auth-background": `url(${authBackground})` } as CSSProperties}>
      <div className="auth-panel">
        <div>
          <p className="eyebrow">Магическая игра в шахматы</p>
          <h1>{mode === "register" ? "Регистрация" : "Chess Quest"}</h1>
        </div>

        <div className="auth-tabs" aria-label="Режим авторизации">
          <Link className={mode === "login" ? "active" : ""} href="/auth?mode=login">Вход</Link>
          <Link className={mode === "register" ? "active" : ""} href="/auth?mode=register">Регистрация</Link>
        </div>

        {error ? <div className="auth-error" role="alert">{error}</div> : null}

        {mode === "register" ? (
          <form className="auth-form" action={registerAction}>
            <label>
              Логин
              <input name="login" type="text" placeholder="player" required />
            </label>
            <label>
              E-mail
              <input name="email" type="email" placeholder="player@example.com" />
            </label>
            <label>
              Имя на карте
              <input name="displayName" type="text" placeholder="Игрок" />
            </label>
            <label>
              Пароль
              <input name="password" type="password" placeholder="password" required />
            </label>
            <button type="submit">Зарегистрироваться</button>
          </form>
        ) : (
          <form className="auth-form" action={loginAction}>
            <label>
              Логин или e-mail
              <input name="login" type="text" placeholder="player@example.com" required />
            </label>
            <label>
              Пароль
              <input name="password" type="password" placeholder="password" required />
            </label>
            <button type="submit">Войти</button>
          </form>
        )}

        <div className="demo-logins" aria-label="Demo editor credentials">
          {/*<span>Демо редактор карт: map / map</span>
          <form action={demoMapEditorLoginAction}>
            <button className="demo-login-button" type="submit">Войти как редактор карты</button>
          </form>*/}
          <span>Играть можно после регистрации или входа.</span>
        </div>
      </div>
    </section>
  );
}
