import { getCurrentUser } from "@/lib/auth/session";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { OnlineServiceError } from "@/lib/online/errors";
import type { OnlineActor } from "@/lib/online/types";

export function requireOnlineDatabase() {
  if (!isDatabaseConfigured()) {
    throw new OnlineServiceError(
      "DATABASE_REQUIRED",
      "Online mode requires PostgreSQL.",
    );
  }

  return getPrisma();
}

export async function requireOnlinePlayer(): Promise<OnlineActor> {
  requireOnlineDatabase();

  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    throw new OnlineServiceError("AUTH_REQUIRED", "Authentication is required.");
  }

  const user = await getPrisma().user.findUnique({
    where: { id: sessionUser.id },
    select: {
      displayName: true,
      id: true,
      onlineRating: true,
      role: true,
    },
  });

  if (!user) {
    throw new OnlineServiceError("AUTH_REQUIRED", "Authenticated user no longer exists.");
  }
  if (user.role !== "PLAYER") {
    throw new OnlineServiceError(
      "PLAYER_ROLE_REQUIRED",
      "Only players can use online mode.",
    );
  }

  return {
    displayName: user.displayName,
    id: user.id,
    onlineRating: user.onlineRating,
  };
}
