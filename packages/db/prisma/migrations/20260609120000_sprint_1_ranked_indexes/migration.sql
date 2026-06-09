-- DropIndex
DROP INDEX "elo_ratings_rating_idx";

-- CreateIndex
CREATE INDEX "elo_ratings_rating_desc_idx" ON "elo_ratings"("rating" DESC, "games_played" DESC);
