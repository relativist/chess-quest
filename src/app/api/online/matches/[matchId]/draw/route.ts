import {
  OnlineHttpError,
  onlineErrorResponse,
  onlineJson,
  readOnlineJsonObject,
  requireNonEmptyString,
} from "@/lib/online/http";
import { handleOnlineDrawAction } from "@/lib/online/match-repository";
import { requireOnlinePlayer } from "@/lib/online/server-auth";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ matchId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const body = await readOnlineJsonObject(request);
    const { matchId } = await context.params;
    const player = await requireOnlinePlayer();
    const snapshot = await handleOnlineDrawAction(matchId, player.id, {
      action: requireDrawAction(body.action),
      clientRequestId: requireNonEmptyString(body.clientRequestId, "clientRequestId"),
      expectedVersion: requireVersion(body.expectedVersion),
    });
    return onlineJson({ snapshot });
  } catch (error) {
    return onlineErrorResponse(error);
  }
}

function requireDrawAction(value: unknown): "accept" | "decline" | "offer" {
  if (value === "accept" || value === "decline" || value === "offer") return value;
  throw new OnlineHttpError("INVALID_ACTION", "Invalid draw action.");
}

function requireVersion(value: unknown) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new OnlineHttpError(
      "INVALID_REQUEST",
      "expectedVersion must be a non-negative integer.",
    );
  }
  return value as number;
}
