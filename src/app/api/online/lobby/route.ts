import {
  onlineErrorResponse,
  onlineJson,
  readOnlineJsonObject,
} from "@/lib/online/http";
import {
  getOnlineLobbySnapshot,
  heartbeatOnlinePresence,
} from "@/lib/online/repository";
import { requireOnlinePlayer } from "@/lib/online/server-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await readOnlineJsonObject(request);
    const player = await requireOnlinePlayer();
    await heartbeatOnlinePresence(player.id);
    const snapshot = await getOnlineLobbySnapshot(player.id);
    return onlineJson({ snapshot });
  } catch (error) {
    return onlineErrorResponse(error);
  }
}
