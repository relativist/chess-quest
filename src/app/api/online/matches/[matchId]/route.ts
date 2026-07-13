import {
  onlineErrorResponse,
  onlineJson,
  requireNonEmptyString,
} from "@/lib/online/http";
import { getOnlineMatchSnapshot } from "@/lib/online/match-repository";
import { requireOnlinePlayer } from "@/lib/online/server-auth";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ matchId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { matchId: rawMatchId } = await context.params;
    const matchId = requireNonEmptyString(rawMatchId, "matchId");
    const player = await requireOnlinePlayer();
    const snapshot = await getOnlineMatchSnapshot(matchId, player.id);
    return onlineJson({ snapshot });
  } catch (error) {
    return onlineErrorResponse(error);
  }
}
