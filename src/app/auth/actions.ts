"use server";

import { redirect } from "next/navigation";
import { loginUser, registerUser } from "@/lib/auth/auth-store";
import { clearSession, setSession } from "@/lib/auth/session";

export async function loginAction(formData: FormData) {
  const result = await loginUser({
    loginOrEmail: String(formData.get("login") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!result.ok) {
    redirect(`/auth?mode=login&error=${encodeURIComponent(result.error)}`);
  }

  await setSession(result.user.id);
  redirect("/map");
}

export async function registerAction(formData: FormData) {
  const result = await registerUser({
    login: String(formData.get("login") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
  });

  if (!result.ok) {
    redirect(`/auth?mode=register&error=${encodeURIComponent(result.error)}`);
  }

  await setSession(result.user.id);
  redirect("/map");
}

export async function demoMapEditorLoginAction() {
  const result = await loginUser({
    loginOrEmail: "map",
    password: "map",
  });

  if (!result.ok) {
    redirect(`/auth?mode=login&error=${encodeURIComponent(result.error)}`);
  }

  await setSession(result.user.id);
  redirect("/map/editor");
}

export async function logoutAction() {
  await clearSession();
  redirect("/auth");
}
