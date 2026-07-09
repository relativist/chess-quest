import Link from "next/link";
import Image from "next/image";
import {redirect} from "next/navigation";
import type {CSSProperties} from "react";
import {loginAction, registerAction} from "@/app/auth/actions";
import {getCurrentUser} from "@/lib/auth/session";
import {getAuthenticatedHomePath} from "@/lib/routing/auth-redirect";
import {publicPath} from "@/lib/routing/public-path";

type AuthPageProps = {
  searchParams: Promise<{ error?: string; mode?: string }>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const user = await getCurrentUser();
  if (user) redirect(getAuthenticatedHomePath(user));

  const params = await searchParams;
  const mode = params.mode === "register" ? "register" : "login";
  const error = params.error ? decodeURIComponent(params.error) : "";
  const authBackground = publicPath("/wall/game_wall.png");
  const battleIconSrc = publicPath("/wall/1/battle.png");
  const logoSrc = publicPath("/wall/1/logo.png");

  return (
    <section className="auth-shell auth-background-page" style={{ "--auth-background": `url(${authBackground})` } as CSSProperties}>
      <div className="auth-layout">
        <div className="auth-panel">
          <div className="auth-brand">
            <Image className="auth-panel-logo" src={logoSrc} alt="" width={72} height={72} />
            <h1 className="auth-title">Chess Quest</h1>
            <p className="auth-subtitle">Шахматный квест</p>
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
                <input name="login" type="text" placeholder="knight" required />
              </label>
              <label>
                E-mail
                <input name="email" type="email" placeholder="knight@example.com" />
              </label>
              <label>
                Имя на карте
                <input name="displayName" type="text" placeholder="Сэр Конь" />
              </label>
              <label>
                Пароль
                <input name="password" type="password" placeholder="secret spell" required />
              </label>
              <button className="auth-submit-button" type="submit">
                <Image src={battleIconSrc} alt="" width={30} height={30} />
                Зарегистрироваться
              </button>
            </form>
          ) : (
            <form className="auth-form" action={loginAction}>
              <label>
                Логин или e-mail
                <input name="login" type="text" placeholder="knight@example.com" required />
              </label>
              <label>
                Пароль
                <input name="password" type="password" placeholder="secret spell" required />
              </label>
              <button className="auth-submit-button" type="submit">
                <Image src={battleIconSrc} alt="" width={30} height={30} />
                Войти
              </button>
            </form>
          )}

          <div className="demo-logins">
            <span>После входа откроется карта похода.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
