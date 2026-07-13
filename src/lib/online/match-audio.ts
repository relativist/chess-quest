import type { OnlineMatchSnapshot } from "@/lib/online/types";

export type OnlineMatchAudioCue =
  | "capture"
  | "check"
  | "defeat"
  | "step"
  | "win";

export function onlineMatchAudioCues(
  previous: OnlineMatchSnapshot | null,
  next: OnlineMatchSnapshot,
): OnlineMatchAudioCue[] {
  if (!previous || next.version <= previous.version) return [];

  const cues: OnlineMatchAudioCue[] = [];
  const previousSequence = previous.history.reduce(
    (latest, event) => Math.max(latest, event.sequence),
    0,
  );
  const latestBoardEvent = next.history
    .filter(
      (event) =>
        event.sequence > previousSequence &&
        (event.type === "MOVE" || event.type === "MAGIC"),
    )
    .at(-1);

  if (latestBoardEvent?.type === "MAGIC") {
    cues.push("step");
  } else if (latestBoardEvent?.type === "MOVE") {
    if (/[+#]$/.test(latestBoardEvent.notation)) cues.push("check");
    else if (latestBoardEvent.notation.includes("x")) cues.push("capture");
    else cues.push("step");
  }

  if (!previous.result && next.result && next.result.outcome !== "DRAW") {
    const playerWon =
      next.result.outcome === `${next.playerColor.toUpperCase()}_WIN`;
    cues.push(playerWon ? "win" : "defeat");
  }

  return cues;
}
