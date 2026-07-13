import type { AuthRole } from "@/lib/auth/auth-store";

export function getAuthenticatedHomePath(user: { role: AuthRole }): "/map/editor" | "/map" {
  return user.role === "MAP_EDITOR" ? "/map/editor" : "/map";
}

export function getPostAuthenticationPath(user: { role: AuthRole }): "/map/editor" | "/start" {
  return user.role === "MAP_EDITOR" ? "/map/editor" : "/start";
}

export function getLoginPath(error: string): `/auth?mode=login&error=${string}` {
  return `/auth?mode=login&error=${encodeURIComponent(error)}`;
}
