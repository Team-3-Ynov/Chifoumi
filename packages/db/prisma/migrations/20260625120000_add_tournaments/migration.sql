-- CreateEnum
CREATE TYPE "TournamentFormat" AS ENUM ('single_elim', 'double_elim');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('upcoming', 'registration_open', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "WinnerSlot" AS ENUM ('a', 'b');

-- CreateTable
CREATE TABLE "tournaments" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "format" "TournamentFormat" NOT NULL,
    "bracket_size" INTEGER NOT NULL,
    "registration_opens_at" TIMESTAMP(3) NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "status" "TournamentStatus" NOT NULL DEFAULT 'upcoming',
    "winner_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_registrations" (
    "tournament_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "seed" INTEGER,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_registrations_pkey" PRIMARY KEY ("tournament_id","user_id")
);

-- CreateTable
CREATE TABLE "tournament_matches" (
    "id" UUID NOT NULL,
    "tournament_id" UUID NOT NULL,
    "round" INTEGER NOT NULL,
    "position_index" INTEGER NOT NULL,
    "match_id" UUID,
    "slot_a_id" UUID,
    "slot_b_id" UUID,
    "next_match_id" UUID,
    "winner_slot" "WinnerSlot",

    CONSTRAINT "tournament_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tournament_registrations_user_id_idx" ON "tournament_registrations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_matches_match_id_key" ON "tournament_matches"("match_id");

-- CreateIndex
CREATE INDEX "tournament_matches_tournament_id_round_idx" ON "tournament_matches"("tournament_id", "round");

-- CreateIndex
CREATE INDEX "tournament_matches_next_match_id_idx" ON "tournament_matches"("next_match_id");

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_slot_a_id_fkey" FOREIGN KEY ("slot_a_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_slot_b_id_fkey" FOREIGN KEY ("slot_b_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_next_match_id_fkey" FOREIGN KEY ("next_match_id") REFERENCES "tournament_matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
