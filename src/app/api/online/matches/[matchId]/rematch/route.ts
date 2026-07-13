import {
  OnlineHttpError,
  onlineErrorResponse,
  onlineJson,
  readOnlineJsonObject,
} from "@/lib/online/http";
import { handleOnlineRematchAction } from "@/lib/online/rematch-repository";
import { requireOnlinePlayer } from "@/lib/online/server-auth";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ matchId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const body = await readOnlineJsonObject(request);
    const action = requireRematchAction(body.action);
    const challengeId = body.challengeId === undefined
      ? undefined
      : requireChallengeId(body.challengeId);
    const { matchId } = await context.params;
    const player = await requireOnlinePlayer();
    const result = await handleOnlineRematchAction(
      matchId,
      player.id,
      { action, challengeId },
    );
    return onlineJson(result);
  } catch (error) {
    return onlineErrorResponse(error);
  }
}

function requireRematchAction(value: unknown): "accept" | "decline" | "offer" {
  if (value === "accept" || value === "decline" || value === "offer") return value;
  throw new OnlineHttpError("INVALID_ACTION", "Invalid rematch action.");
}

function requireChallengeId(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new OnlineHttpError("INVALID_REQUEST", "challengeId must be a string.");
  }
  return value.trim();
}
