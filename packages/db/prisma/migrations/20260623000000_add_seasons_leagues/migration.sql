-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('upcoming', 'active', 'closed');

-- CreateTable
CREATE TABLE "leagues" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "min_rating" INTEGER NOT NULL,
    "max_rating" INTEGER,
    "tier" INTEGER NOT NULL,

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "status" "SeasonStatus" NOT NULL DEFAULT 'upcoming',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_standings" (
    "id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "final_rating" INTEGER NOT NULL,
    "final_league_id" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "rewards_distributed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "season_standings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leagues_name_key" ON "leagues"("name");

-- CreateIndex
CREATE UNIQUE INDEX "leagues_tier_key" ON "leagues"("tier");

-- CreateIndex
CREATE INDEX "seasons_status_idx" ON "seasons"("status");

-- Partial unique index: at most one active season at a time (AC1 #111).
-- Prisma does not support partial indexes natively; kept as raw SQL.
CREATE UNIQUE INDEX "seasons_single_active_idx" ON "seasons"("status") WHERE "status" = 'active';

-- CreateIndex
CREATE UNIQUE INDEX "season_standings_season_id_user_id_key" ON "season_standings"("season_id", "user_id");

-- CreateIndex
CREATE INDEX "season_standings_season_id_rank_idx" ON "season_standings"("season_id", "rank");

-- CreateIndex
CREATE INDEX "season_standings_user_id_idx" ON "season_standings"("user_id");

-- AddForeignKey
ALTER TABLE "season_standings" ADD CONSTRAINT "season_standings_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_standings" ADD CONSTRAINT "season_standings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_standings" ADD CONSTRAINT "season_standings_final_league_id_fkey" FOREIGN KEY ("final_league_id") REFERENCES "leagues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
