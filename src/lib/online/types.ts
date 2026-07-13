export type OnlineColor = "white" | "black";

export type PublicOnlinePlayer = {
  id: string;
  name: string;
  onlineRating: number;
};

export type OnlineMatchPlayers = {
  whitePlayerId: string;
  blackPlayerId: string;
};

export type OnlineColorAssignment = OnlineMatchPlayers;

export type OnlineMatchClocks = {
  whiteTimeMs: number;
  blackTimeMs: number;
};

export type DebitedOnlineMatchClocks = OnlineMatchClocks & {
  activeColor: OnlineColor;
  elapsedMs: number;
  timedOut: boolean;
};

export type OnlineActor = {
  displayName: string;
  id: string;
  onlineRating: number;
};

export type OnlineChallengeSummary = {
  expiresAt: string;
  id: string;
  player: PublicOnlinePlayer;
};

export type OnlineLobbySnapshot = {
  activeMatchId: string | null;
  incomingChallenges: OnlineChallengeSummary[];
  outgoingChallenges: OnlineChallengeSummary[];
  players: PublicOnlinePlayer[];
  serverTime: string;
};

export type OnlineMatchStatus = "ACTIVE" | "FINISHED";
export type OnlineMatchResultValue = "WHITE_WIN" | "BLACK_WIN" | "DRAW";
export type OnlineMatchFinishReason =
  | "CHECKMATE"
  | "TIMEOUT"
  | "SURRENDER"
  | "DRAW_AGREEMENT"
  | "STALEMATE"
  | "INSUFFICIENT_MATERIAL"
  | "THREEFOLD_REPETITION"
  | "FIFTY_MOVE_RULE";

export type OnlineMatchEventSummary = {
  actorId: string | null;
  createdAt: string;
  notation: string;
  sequence: number;
  type:
    | "MOVE"
    | "MAGIC"
    | "DRAW_OFFERED"
    | "DRAW_DECLINED"
    | "DRAW_ACCEPTED"
    | "SURRENDERED"
    | "TIMED_OUT"
    | "MATCH_FINISHED";
};

export type OnlineMatchSnapshot = {
  clocks: OnlineMatchClocks & { activeColor: OnlineColor | null };
  draw: {
    offersRemaining: number;
    offersUsed: number;
    opponentOffersUsed: number;
    pendingOfferBy: "self" | "opponent" | null;
  };
  fen: string;
  history: OnlineMatchEventSummary[];
  id: string;
  magicCoins: { black: number; white: number };
  rematch: {
    challengeId: string | null;
    nextMatchId: string | null;
    state: "NONE" | "OFFERED_BY_YOU" | "OFFERED_BY_OPPONENT" | "MATCH_CREATED";
  };
  playerColor: OnlineColor;
  players: { black: PublicOnlinePlayer; white: PublicOnlinePlayer };
  result: {
    finishedAt: string;
    outcome: OnlineMatchResultValue;
    reason: OnlineMatchFinishReason;
  } | null;
  serverTime: string;
  status: OnlineMatchStatus;
  turnColor: OnlineColor;
  version: number;
};

export type PlayOnlineMoveInput = {
  clientRequestId: string;
  expectedVersion: number;
  from: string;
  promotion?: "b" | "n" | "q" | "r";
  to: string;
};

export type UseOnlineMagicInput = {
  clientRequestId: string;
  expectedVersion: number;
  magicId: string;
  targetSquare: string;
};

export type FinishOnlineMatchInput = {
  clientRequestId: string;
  expectedVersion: number;
};

export type OnlineDrawAction = "offer" | "accept" | "decline";

export type OnlineDrawActionInput = FinishOnlineMatchInput & {
  action: OnlineDrawAction;
};

export type OnlineRematchActionInput = {
  action: "offer" | "accept" | "decline";
  challengeId?: string;
};
