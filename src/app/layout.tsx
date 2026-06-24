import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { logoutAction } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { getBasePath, publicPath } from "@/lib/routing/public-path";
import "./globals.css";

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

  return (
    <html lang="ru">
      <body>
        <header className="app-header">
          <Link className="brand" href="/map" aria-label="Chess Quest map">
            <span className="brand-mark" aria-hidden="true">
              <Image src={publicPath("/favicon.png")} alt="" width={32} height={32} priority />
            </span>
            <span>Chess Quest</span>
          </Link>
          <nav className="top-nav" aria-label="Main navigation">
            {user ? <span className="user-pill">{user.displayName}</span> : <Link href="/auth">Вход</Link>}
            <Link href="/map">Карта</Link>
            {user?.role === "MAP_EDITOR" ? <Link href="/map/editor">Редактор</Link> : null}
            {user ? (
              <form action={logoutAction}>
                <button className="nav-button" type="submit">Выход</button>
              </form>
            ) : null}
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
