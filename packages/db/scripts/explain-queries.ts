import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const LEADERBOARD_EXPLAIN = `
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT er.user_id, er.rating, er.games_played
FROM elo_ratings er
ORDER BY er.rating DESC, er.games_played DESC
LIMIT 50;
`;

const HISTORY_EXPLAIN = `
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT m.id, m.player_a_id, m.player_b_id, m.ended_at
FROM matches m
WHERE m.status = 'ended'
  AND m.ended_at IS NOT NULL
  AND (m.player_a_id = $1::uuid OR m.player_b_id = $1::uuid)
ORDER BY m.ended_at DESC, m.id DESC
LIMIT 21;
`;

function printQueryPlan(rows: Array<Record<string, string>>): void {
  for (const row of rows) {
    console.log(row["QUERY PLAN"]);
  }
}

async function resolveUserId(client: pg.Client): Promise<string> {
  const configuredUserId = process.env.BENCH_USER_ID;
  if (configuredUserId) {
    return configuredUserId;
  }

  const result = await client.query<{ id: string }>(
    "SELECT id FROM users ORDER BY created_at LIMIT 1",
  );
  const userId = result.rows[0]?.id;
  if (!userId) {
    throw new Error("No users found. Run seed:bench first.");
  }

  return userId;
}

async function main(): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const userId = await resolveUserId(client);

    console.log("=== US-028 EXPLAIN ANALYZE — leaderboard top 50 ===");
    await client.query("ANALYZE elo_ratings;");
    printQueryPlan((await client.query(LEADERBOARD_EXPLAIN)).rows);

    console.log();
    console.log(`=== US-028 EXPLAIN ANALYZE — player history (user ${userId}) ===`);
    await client.query("ANALYZE matches;");
    printQueryPlan((await client.query(HISTORY_EXPLAIN, [userId])).rows);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
