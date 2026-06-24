-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLAYER', 'BOARD_EDITOR', 'MAP_EDITOR');

-- CreateEnum
CREATE TYPE "PlayerColor" AS ENUM ('WHITE', 'BLACK');

-- CreateEnum
CREATE TYPE "GameOutcome" AS ENUM ('IN_PROGRESS', 'PLAYER_WIN', 'ENGINE_WIN', 'DRAW', 'ENGINE_ERROR', 'ABANDONED');

-- CreateEnum
CREATE TYPE "VictoryReason" AS ENUM ('CHECKMATE', 'ENGINE_SURRENDER', 'CARD_OBJECTIVE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "victoryScore" INTEGER NOT NULL DEFAULT 0,
    "gold" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fen" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "BoardTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestMap" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "QuestMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestCard" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "congratulationsText" TEXT NOT NULL DEFAULT '',
    "objective" JSONB,
    "startingFen" TEXT,
    "difficulty" SMALLINT NOT NULL,
    "rewardGold" INTEGER NOT NULL,
    "rewardScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mapId" TEXT NOT NULL,
    "boardTemplateId" TEXT,

    CONSTRAINT "QuestCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardProgress" (
    "id" TEXT NOT NULL,
    "victories" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "firstCompletedAt" TIMESTAMP(3),
    "lastCompletedAt" TIMESTAMP(3),
    "earnedScore" INTEGER NOT NULL DEFAULT 0,
    "earnedGold" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,

    CONSTRAINT "CardProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "startingFen" TEXT,
    "playerColor" "PlayerColor",
    "engineDifficulty" SMALLINT NOT NULL,
    "outcome" "GameOutcome" NOT NULL DEFAULT 'IN_PROGRESS',
    "victoryReason" "VictoryReason",
    "rewardScore" INTEGER NOT NULL DEFAULT 0,
    "rewardGold" INTEGER NOT NULL DEFAULT 0,
    "moveHistory" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "boardTemplateId" TEXT,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_victoryScore_idx" ON "User"("victoryScore");

-- CreateIndex
CREATE UNIQUE INDEX "BoardTemplate_slug_key" ON "BoardTemplate"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "BoardTemplate_name_key" ON "BoardTemplate"("name");

-- CreateIndex
CREATE INDEX "BoardTemplate_createdById_idx" ON "BoardTemplate"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "QuestMap_slug_key" ON "QuestMap"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "QuestMap_order_key" ON "QuestMap"("order");

-- CreateIndex
CREATE INDEX "QuestMap_isPublished_order_idx" ON "QuestMap"("isPublished", "order");

-- CreateIndex
CREATE INDEX "QuestMap_createdById_idx" ON "QuestMap"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "QuestCard_slug_key" ON "QuestCard"("slug");

-- CreateIndex
CREATE INDEX "QuestCard_mapId_idx" ON "QuestCard"("mapId");

-- CreateIndex
CREATE INDEX "QuestCard_boardTemplateId_idx" ON "QuestCard"("boardTemplateId");

-- CreateIndex
CREATE INDEX "QuestCard_difficulty_idx" ON "QuestCard"("difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "QuestCard_mapId_order_key" ON "QuestCard"("mapId", "order");

-- CreateIndex
CREATE INDEX "CardProgress_cardId_idx" ON "CardProgress"("cardId");

-- CreateIndex
CREATE INDEX "CardProgress_completed_idx" ON "CardProgress"("completed");

-- CreateIndex
CREATE UNIQUE INDEX "CardProgress_userId_cardId_key" ON "CardProgress"("userId", "cardId");

-- CreateIndex
CREATE INDEX "GameSession_userId_startedAt_idx" ON "GameSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "GameSession_cardId_idx" ON "GameSession"("cardId");

-- CreateIndex
CREATE INDEX "GameSession_outcome_idx" ON "GameSession"("outcome");

-- AddForeignKey
ALTER TABLE "BoardTemplate" ADD CONSTRAINT "BoardTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestMap" ADD CONSTRAINT "QuestMap_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestCard" ADD CONSTRAINT "QuestCard_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "QuestMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestCard" ADD CONSTRAINT "QuestCard_boardTemplateId_fkey" FOREIGN KEY ("boardTemplateId") REFERENCES "BoardTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardProgress" ADD CONSTRAINT "CardProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardProgress" ADD CONSTRAINT "CardProgress_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "QuestCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "QuestCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_boardTemplateId_fkey" FOREIGN KEY ("boardTemplateId") REFERENCES "BoardTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
