import { NextResponse, type NextRequest } from "next/server";
import { getBasePath } from "@/lib/routing/public-path";

const SESSION_COOKIE = "chess_quest_session";

export function middleware(request: NextRequest) {
  const basePath = getBasePath();
  const targetPath = request.cookies.has(SESSION_COOKIE) ? "/map" : "/auth";
  return NextResponse.redirect(new URL(`${basePath}${targetPath}`, request.url));
}

export const config = {
  matcher: "/",
};
