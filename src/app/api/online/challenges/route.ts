import {
  onlineErrorResponse,
  onlineJson,
  readOnlineJsonObject,
  requireNonEmptyString,
} from "@/lib/online/http";
import { createOnlineChallenge } from "@/lib/online/repository";
import { requireOnlinePlayer } from "@/lib/online/server-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readOnlineJsonObject(request);
    const challengedId = requireNonEmptyString(body.challengedId, "challengedId");
    const player = await requireOnlinePlayer();
    const challenge = await createOnlineChallenge(player.id, challengedId);
    return onlineJson({ challenge }, { status: 201 });
  } catch (error) {
    return onlineErrorResponse(error);
  }
}
