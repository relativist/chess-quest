import { NextResponse, type NextRequest } from "next/server";
import { getBasePath } from "@/lib/routing/public-path";

const SESSION_COOKIE = "chess_quest_session";

export function middleware(request: NextRequest) {
  const basePath = getBasePath();
  if (request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL(`${basePath}/auth`, request.url));
}

export const config = {
  matcher: "/",
};
