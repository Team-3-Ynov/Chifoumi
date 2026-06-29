-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('in_progress', 'ended', 'aborted');

-- CreateEnum
CREATE TYPE "Move" AS ENUM ('rock', 'paper', 'scissors');

-- CreateEnum
CREATE TYPE "RoundWinner" AS ENUM ('a', 'b', 'draw');

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "player_a_id" UUID NOT NULL,
    "player_b_id" UUID NOT NULL,
    "winner_id" UUID,
    "score_a" INTEGER NOT NULL,
    "score_b" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "status" "MatchStatus" NOT NULL DEFAULT 'in_progress',

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "matches_different_players_check" CHECK ("player_a_id" <> "player_b_id")
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "round_number" INTEGER NOT NULL,
    "move_a" "Move",
    "move_b" "Move",
    "commit_a" TEXT,
    "commit_b" TEXT,
    "nonce_a" TEXT,
    "nonce_b" TEXT,
    "winner" "RoundWinner" NOT NULL,
    "resolved_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elo_history" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "rating_before" INTEGER NOT NULL,
    "rating_after" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "elo_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "matches_player_a_id_ended_at_idx" ON "matches"("player_a_id", "ended_at" DESC);

-- CreateIndex
CREATE INDEX "matches_player_b_id_ended_at_idx" ON "matches"("player_b_id", "ended_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "rounds_match_id_round_number_key" ON "rounds"("match_id", "round_number");

-- CreateIndex
CREATE INDEX "elo_history_user_id_created_at_idx" ON "elo_history"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_player_a_id_fkey" FOREIGN KEY ("player_a_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_player_b_id_fkey" FOREIGN KEY ("player_b_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elo_history" ADD CONSTRAINT "elo_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elo_history" ADD CONSTRAINT "elo_history_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
