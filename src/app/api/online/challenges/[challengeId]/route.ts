import {
  OnlineHttpError,
  onlineErrorResponse,
  onlineJson,
  readOnlineJsonObject,
  requireNonEmptyString,
} from "@/lib/online/http";
import {
  acceptOnlineChallenge,
  cancelOnlineChallenge,
  declineOnlineChallenge,
} from "@/lib/online/repository";
import { requireOnlinePlayer } from "@/lib/online/server-auth";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ challengeId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const body = await readOnlineJsonObject(request);
    const action = requireChallengeAction(body.action);
    const { challengeId: rawChallengeId } = await context.params;
    const challengeId = requireNonEmptyString(rawChallengeId, "challengeId");
    const player = await requireOnlinePlayer();

    if (action === "accept") {
      const match = await acceptOnlineChallenge(challengeId, player.id);
      return onlineJson({ match });
    }

    const challenge = action === "decline"
      ? await declineOnlineChallenge(challengeId, player.id)
      : await cancelOnlineChallenge(challengeId, player.id);
    return onlineJson({ challenge });
  } catch (error) {
    return onlineErrorResponse(error);
  }
}

function requireChallengeAction(value: unknown): "accept" | "decline" | "cancel" {
  if (value === "accept" || value === "decline" || value === "cancel") return value;
  throw new OnlineHttpError(
    "INVALID_ACTION",
    "action must be accept, decline, or cancel.",
  );
}
