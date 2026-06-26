"use server";

import { redirect } from "next/navigation";
import { loginUser, registerUser } from "@/lib/auth/auth-store";
import { clearSession, setSession } from "@/lib/auth/session";
import { getAuthenticatedHomePath } from "@/lib/routing/auth-redirect";
import { publicPath } from "@/lib/routing/public-path";

export async function loginAction(formData: FormData) {
  const result = await loginUser({
    loginOrEmail: String(formData.get("login") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!result.ok) {
    redirect(publicPath(`/auth?mode=login&error=${encodeURIComponent(result.error)}`));
  }

  await setSession(result.user.id);
  redirect(publicPath(getAuthenticatedHomePath(result.user)));
}

export async function registerAction(formData: FormData) {
  const result = await registerUser({
    login: String(formData.get("login") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
  });

  if (!result.ok) {
    redirect(publicPath(`/auth?mode=register&error=${encodeURIComponent(result.error)}`));
  }

  await setSession(result.user.id);
  redirect(publicPath(getAuthenticatedHomePath(result.user)));
}

export async function demoMapEditorLoginAction() {
  const result = await loginUser({
    loginOrEmail: "map",
    password: "map",
  });

  if (!result.ok) {
    redirect(publicPath(`/auth?mode=login&error=${encodeURIComponent(result.error)}`));
  }

  await setSession(result.user.id);
  redirect(publicPath("/map/editor"));
}

export async function logoutAction() {
  await clearSession();
  redirect(publicPath("/auth"));
}
