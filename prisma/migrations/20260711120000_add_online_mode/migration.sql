-- CreateEnum
CREATE TYPE "OnlineChallengeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OnlineMatchStatus" AS ENUM ('ACTIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "OnlineMatchResult" AS ENUM ('WHITE_WIN', 'BLACK_WIN', 'DRAW');

-- CreateEnum
CREATE TYPE "OnlineMatchFinishReason" AS ENUM ('CHECKMATE', 'TIMEOUT', 'SURRENDER', 'DRAW_AGREEMENT', 'STALEMATE', 'INSUFFICIENT_MATERIAL', 'THREEFOLD_REPETITION', 'FIFTY_MOVE_RULE');

-- CreateEnum
CREATE TYPE "OnlineMatchEventType" AS ENUM ('MOVE', 'MAGIC', 'DRAW_OFFERED', 'DRAW_DECLINED', 'DRAW_ACCEPTED', 'SURRENDERED', 'TIMED_OUT', 'MATCH_FINISHED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onlineRating" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlinePlayerState" (
    "userId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeMatchId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlinePlayerState_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "OnlineChallenge" (
    "id" TEXT NOT NULL,
    "status" "OnlineChallengeStatus" NOT NULL DEFAULT 'PENDING',
    "activeKey" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "challengerId" TEXT NOT NULL,
    "challengedId" TEXT NOT NULL,

    CONSTRAINT "OnlineChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlineMatch" (
    "id" TEXT NOT NULL,
    "status" "OnlineMatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "result" "OnlineMatchResult",
    "finishReason" "OnlineMatchFinishReason",
    "fen" TEXT NOT NULL,
    "moveHistory" JSONB,
    "version" INTEGER NOT NULL DEFAULT 0,
    "whiteTimeMs" INTEGER NOT NULL DEFAULT 600000,
    "blackTimeMs" INTEGER NOT NULL DEFAULT 600000,
    "turnStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "whiteMagicCoins" INTEGER NOT NULL DEFAULT 500,
    "blackMagicCoins" INTEGER NOT NULL DEFAULT 500,
    "whiteDrawOfferCount" INTEGER NOT NULL DEFAULT 0,
    "blackDrawOfferCount" INTEGER NOT NULL DEFAULT 0,
    "pendingDrawOfferById" TEXT,
    "ratingAppliedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "challengeId" TEXT NOT NULL,
    "whitePlayerId" TEXT NOT NULL,
    "blackPlayerId" TEXT NOT NULL,

    CONSTRAINT "OnlineMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlineMatchEvent" (
    "id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" "OnlineMatchEventType" NOT NULL,
    "payload" JSONB,
    "clientRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchId" TEXT NOT NULL,
    "actorId" TEXT,

    CONSTRAINT "OnlineMatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlineRatingChange" (
    "id" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "ratingAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "OnlineRatingChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "OnlinePlayerState_lastSeenAt_idx" ON "OnlinePlayerState"("lastSeenAt");

-- CreateIndex
CREATE INDEX "OnlinePlayerState_activeMatchId_idx" ON "OnlinePlayerState"("activeMatchId");

-- CreateIndex
CREATE UNIQUE INDEX "OnlineChallenge_activeKey_key" ON "OnlineChallenge"("activeKey");

-- CreateIndex
CREATE INDEX "OnlineChallenge_challengerId_status_idx" ON "OnlineChallenge"("challengerId", "status");

-- CreateIndex
CREATE INDEX "OnlineChallenge_challengedId_status_idx" ON "OnlineChallenge"("challengedId", "status");

-- CreateIndex
CREATE INDEX "OnlineChallenge_status_expiresAt_idx" ON "OnlineChallenge"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OnlineMatch_challengeId_key" ON "OnlineMatch"("challengeId");

-- CreateIndex
CREATE INDEX "OnlineMatch_whitePlayerId_status_idx" ON "OnlineMatch"("whitePlayerId", "status");

-- CreateIndex
CREATE INDEX "OnlineMatch_blackPlayerId_status_idx" ON "OnlineMatch"("blackPlayerId", "status");

-- CreateIndex
CREATE INDEX "OnlineMatch_status_updatedAt_idx" ON "OnlineMatch"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "OnlineMatch_pendingDrawOfferById_idx" ON "OnlineMatch"("pendingDrawOfferById");

-- CreateIndex
CREATE UNIQUE INDEX "OnlineMatchEvent_clientRequestId_key" ON "OnlineMatchEvent"("clientRequestId");

-- CreateIndex
CREATE INDEX "OnlineMatchEvent_matchId_createdAt_idx" ON "OnlineMatchEvent"("matchId", "createdAt");

-- CreateIndex
CREATE INDEX "OnlineMatchEvent_actorId_idx" ON "OnlineMatchEvent"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "OnlineMatchEvent_matchId_sequence_key" ON "OnlineMatchEvent"("matchId", "sequence");

-- CreateIndex
CREATE INDEX "OnlineRatingChange_userId_createdAt_idx" ON "OnlineRatingChange"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OnlineRatingChange_matchId_userId_key" ON "OnlineRatingChange"("matchId", "userId");

-- CreateIndex
CREATE INDEX "User_onlineRating_idx" ON "User"("onlineRating");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlinePlayerState" ADD CONSTRAINT "OnlinePlayerState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlinePlayerState" ADD CONSTRAINT "OnlinePlayerState_activeMatchId_fkey" FOREIGN KEY ("activeMatchId") REFERENCES "OnlineMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineChallenge" ADD CONSTRAINT "OnlineChallenge_challengerId_fkey" FOREIGN KEY ("challengerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineChallenge" ADD CONSTRAINT "OnlineChallenge_challengedId_fkey" FOREIGN KEY ("challengedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineMatch" ADD CONSTRAINT "OnlineMatch_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "OnlineChallenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineMatch" ADD CONSTRAINT "OnlineMatch_whitePlayerId_fkey" FOREIGN KEY ("whitePlayerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineMatch" ADD CONSTRAINT "OnlineMatch_blackPlayerId_fkey" FOREIGN KEY ("blackPlayerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineMatch" ADD CONSTRAINT "OnlineMatch_pendingDrawOfferById_fkey" FOREIGN KEY ("pendingDrawOfferById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineMatchEvent" ADD CONSTRAINT "OnlineMatchEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "OnlineMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineMatchEvent" ADD CONSTRAINT "OnlineMatchEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineRatingChange" ADD CONSTRAINT "OnlineRatingChange_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "OnlineMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineRatingChange" ADD CONSTRAINT "OnlineRatingChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Domain invariants not expressible in Prisma schema
ALTER TABLE "User"
  ADD CONSTRAINT "User_onlineRating_nonnegative" CHECK ("onlineRating" >= 0);

ALTER TABLE "AuthSession"
  ADD CONSTRAINT "AuthSession_expiry_after_creation" CHECK ("expiresAt" > "createdAt");

ALTER TABLE "OnlineChallenge"
  ADD CONSTRAINT "OnlineChallenge_distinct_players" CHECK ("challengerId" <> "challengedId"),
  ADD CONSTRAINT "OnlineChallenge_expiry_after_creation" CHECK ("expiresAt" > "createdAt"),
  ADD CONSTRAINT "OnlineChallenge_active_key_matches_status" CHECK (
    ("status" = 'PENDING' AND "activeKey" IS NOT NULL)
    OR ("status" <> 'PENDING' AND "activeKey" IS NULL)
  );

ALTER TABLE "OnlineMatch"
  ADD CONSTRAINT "OnlineMatch_distinct_players" CHECK ("whitePlayerId" <> "blackPlayerId"),
  ADD CONSTRAINT "OnlineMatch_version_nonnegative" CHECK ("version" >= 0),
  ADD CONSTRAINT "OnlineMatch_clocks_nonnegative" CHECK ("whiteTimeMs" >= 0 AND "blackTimeMs" >= 0),
  ADD CONSTRAINT "OnlineMatch_magic_nonnegative" CHECK ("whiteMagicCoins" >= 0 AND "blackMagicCoins" >= 0),
  ADD CONSTRAINT "OnlineMatch_draw_offer_limits" CHECK (
    "whiteDrawOfferCount" BETWEEN 0 AND 3
    AND "blackDrawOfferCount" BETWEEN 0 AND 3
  ),
  ADD CONSTRAINT "OnlineMatch_pending_draw_player" CHECK (
    "pendingDrawOfferById" IS NULL
    OR "pendingDrawOfferById" = "whitePlayerId"
    OR "pendingDrawOfferById" = "blackPlayerId"
  ),
  ADD CONSTRAINT "OnlineMatch_terminal_state" CHECK (
    (
      "status" = 'ACTIVE'
      AND "result" IS NULL
      AND "finishReason" IS NULL
      AND "finishedAt" IS NULL
      AND "ratingAppliedAt" IS NULL
    )
    OR (
      "status" = 'FINISHED'
      AND "result" IS NOT NULL
      AND "finishReason" IS NOT NULL
      AND "finishedAt" IS NOT NULL
    )
  );

ALTER TABLE "OnlineMatchEvent"
  ADD CONSTRAINT "OnlineMatchEvent_sequence_positive" CHECK ("sequence" > 0);

ALTER TABLE "OnlineRatingChange"
  ADD CONSTRAINT "OnlineRatingChange_delta_valid" CHECK ("delta" IN (-1, 1)),
  ADD CONSTRAINT "OnlineRatingChange_rating_nonnegative" CHECK ("ratingAfter" >= 0);
