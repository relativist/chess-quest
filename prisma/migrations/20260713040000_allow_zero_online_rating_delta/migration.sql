ALTER TABLE "OnlineRatingChange"
  DROP CONSTRAINT "OnlineRatingChange_delta_valid",
  ADD CONSTRAINT "OnlineRatingChange_delta_valid" CHECK ("delta" IN (-1, 0, 1));
