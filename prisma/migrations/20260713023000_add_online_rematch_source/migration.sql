-- AlterTable
ALTER TABLE "OnlineChallenge" ADD COLUMN "rematchOfMatchId" TEXT;

-- CreateIndex
CREATE INDEX "OnlineChallenge_rematchOfMatchId_status_idx" ON "OnlineChallenge"("rematchOfMatchId", "status");

-- AddForeignKey
ALTER TABLE "OnlineChallenge" ADD CONSTRAINT "OnlineChallenge_rematchOfMatchId_fkey" FOREIGN KEY ("rematchOfMatchId") REFERENCES "OnlineMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
