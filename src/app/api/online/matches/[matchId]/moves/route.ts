import {
  OnlineHttpError,
  onlineErrorResponse,
  onlineJson,
  readOnlineJsonObject,
  requireNonEmptyString,
} from "@/lib/online/http";
import { playOnlineMove } from "@/lib/online/match-repository";
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
    const player = await requireOnlinePlayer();
    const snapshot = await playOnlineMove(matchId, player.id, {
      clientRequestId: requireNonEmptyString(body.clientRequestId, "clientRequestId"),
      expectedVersion: requireVersion(body.expectedVersion),
      from: requireSquare(body.from, "from"),
      promotion: requirePromotion(body.promotion),
      to: requireSquare(body.to, "to"),
    });
    return onlineJson({ snapshot });
  } catch (error) {
    return onlineErrorResponse(error);
  }
}

function requireSquare(value: unknown, field: string) {
  const square = requireNonEmptyString(value, field);
  if (!/^[a-h][1-8]$/.test(square)) {
    throw new OnlineHttpError("INVALID_REQUEST", `${field} must be a chess square.`);
  }
  return square;
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

function requirePromotion(value: unknown): "b" | "n" | "q" | "r" | undefined {
  if (value === undefined) return undefined;
  if (value === "b" || value === "n" || value === "q" || value === "r") return value;
  throw new OnlineHttpError("INVALID_REQUEST", "promotion is invalid.");
}
