import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuthenticatedHomePath } from "@/lib/routing/auth-redirect";
import { publicPath } from "@/lib/routing/public-path";

export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(publicPath(user ? getAuthenticatedHomePath(user) : "/auth"));
}
