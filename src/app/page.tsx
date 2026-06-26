import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuthenticatedHomePath } from "@/lib/routing/auth-redirect";

export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? getAuthenticatedHomePath(user) : "/auth");
}
