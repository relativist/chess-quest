import {
  OnlineHttpError,
  onlineErrorResponse,
  onlineJson,
  readOnlineJsonObject,
  requireNonEmptyString,
} from "@/lib/online/http";
import { applyOnlineMagic } from "@/lib/online/match-repository";
import { requireOnlinePlayer } from "@/lib/online/server-auth";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ matchId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const body = await readOnlineJsonObject(request);
    const { matchId: rawMatchId } = await context.params;
    const matchId = requireNonEmptyString(rawMatchId, "matchId");
    const targetSquare = requireNonEmptyString(body.targetSquare, "targetSquare");
    if (!/^[a-h][1-8]$/.test(targetSquare)) {
      throw new OnlineHttpError(
        "INVALID_REQUEST",
        "targetSquare must be a chess square.",
      );
    }

    const player = await requireOnlinePlayer();
    const snapshot = await applyOnlineMagic(matchId, player.id, {
      clientRequestId: requireNonEmptyString(body.clientRequestId, "clientRequestId"),
      expectedVersion: requireVersion(body.expectedVersion),
      magicId: requireNonEmptyString(body.magicId, "magicId"),
      targetSquare,
    });
    return onlineJson({ snapshot });
  } catch (error) {
    return onlineErrorResponse(error);
  }
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
