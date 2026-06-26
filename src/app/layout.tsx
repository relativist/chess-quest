import type { Metadata } from "next";
import { logoutAction } from "@/app/auth/actions";
import { AppHeader } from "@/components/app-header";
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
        <AppHeader faviconSrc={publicPath("/favicon.png")} logout={logoutAction} user={user} />
        <main>{children}</main>
      </body>
    </html>
  );
}
