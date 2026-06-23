import "dotenv/config";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { MatchStatus, Move, PrismaClient, RoundWinner, UserRole } from "@prisma/client";
import { hashPassword } from "../src/seed/password.js";

const FORCE = process.argv.includes("--force");
const DEMO_PASSWORD = "Demo1234!";
const DEMO_DOMAIN = "@chifoumi.demo";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// ── ELO ──────────────────────────────────────────────────────────────────────

function eloDeltas(
  ratingA: number,
  ratingB: number,
  outcome: "a" | "b" | "draw",
): { deltaA: number; deltaB: number } {
  const K = 32;
  const ea = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
  const saA = outcome === "a" ? 1 : outcome === "draw" ? 0.5 : 0;
  const deltaA = Math.round(K * (saA - ea));
  return { deltaA, deltaB: -deltaA };
}

// ── Move helpers ─────────────────────────────────────────────────────────────

function resolveRound(moveA: Move, moveB: Move): RoundWinner {
  if (moveA === moveB) return RoundWinner.draw;
  if (
    (moveA === Move.rock && moveB === Move.scissors) ||
    (moveA === Move.scissors && moveB === Move.paper) ||
    (moveA === Move.paper && moveB === Move.rock)
  )
    return RoundWinner.a;
  return RoundWinner.b;
}

function fakeCommit(move: Move, nonce: string): string {
  return createHash("sha256").update(`${move}:${nonce}`).digest("hex");
}

function randomHex(): string {
  return randomBytes(16).toString("hex");
}

// ── Player & match data ───────────────────────────────────────────────────────

const PLAYERS = [
  { email: `ryu${DEMO_DOMAIN}`, displayName: "ryu_sensei" }, // 0  top player
  { email: `sakura${DEMO_DOMAIN}`, displayName: "sakura_bloom" }, // 1
  { email: `ken${DEMO_DOMAIN}`, displayName: "ken_masters" }, // 2
  { email: `chunli${DEMO_DOMAIN}`, displayName: "chunli_kicks" }, // 3
  { email: `zangief${DEMO_DOMAIN}`, displayName: "zangief_crush" }, // 4
  { email: `blanka${DEMO_DOMAIN}`, displayName: "blanka_wild" }, // 5
  { email: `dan${DEMO_DOMAIN}`, displayName: "dan_hibiki" }, // 6
  { email: `birdie${DEMO_DOMAIN}`, displayName: "birdie_spike" }, // 7  bottom
];

type RoundDef = { moveA: Move; moveB: Move };
type MatchDef = { a: number; b: number; daysAgo: number; rounds: RoundDef[] };

const M = Move;

// Each 2-round match produces a 2-0; 3-round matches produce a 2-1.
// Round winner rules: rock>scissors, scissors>paper, paper>rock.
const MATCHES: MatchDef[] = [
  // ── Week 4 ───────────────────────────────────────────────────────────────
  {
    a: 0,
    b: 7,
    daysAgo: 28,
    rounds: [
      // ryu beats birdie 2-0
      { moveA: M.rock, moveB: M.scissors },
      { moveA: M.paper, moveB: M.rock },
    ],
  },
  {
    a: 1,
    b: 6,
    daysAgo: 27,
    rounds: [
      // sakura beats dan 2-0
      { moveA: M.scissors, moveB: M.paper },
      { moveA: M.rock, moveB: M.scissors },
    ],
  },
  {
    a: 2,
    b: 7,
    daysAgo: 26,
    rounds: [
      // ken beats birdie 2-0
      { moveA: M.paper, moveB: M.rock },
      { moveA: M.scissors, moveB: M.paper },
    ],
  },
  {
    a: 0,
    b: 6,
    daysAgo: 25,
    rounds: [
      // ryu beats dan 2-0
      { moveA: M.rock, moveB: M.scissors },
      { moveA: M.paper, moveB: M.rock },
    ],
  },
  {
    a: 3,
    b: 5,
    daysAgo: 24,
    rounds: [
      // chunli beats blanka 2-0
      { moveA: M.paper, moveB: M.rock },
      { moveA: M.scissors, moveB: M.paper },
    ],
  },
  // ── Week 3 ───────────────────────────────────────────────────────────────
  {
    a: 1,
    b: 4,
    daysAgo: 23,
    rounds: [
      // sakura beats zangief 2-0
      { moveA: M.scissors, moveB: M.paper },
      { moveA: M.rock, moveB: M.scissors },
    ],
  },
  {
    a: 2,
    b: 6,
    daysAgo: 22,
    rounds: [
      // ken beats dan 2-0
      { moveA: M.rock, moveB: M.scissors },
      { moveA: M.scissors, moveB: M.paper },
    ],
  },
  {
    a: 0,
    b: 5,
    daysAgo: 21,
    rounds: [
      // ryu beats blanka 2-0
      { moveA: M.rock, moveB: M.scissors },
      { moveA: M.paper, moveB: M.rock },
    ],
  },
  {
    a: 4,
    b: 7,
    daysAgo: 20,
    rounds: [
      // zangief beats birdie 2-0
      { moveA: M.rock, moveB: M.scissors },
      { moveA: M.scissors, moveB: M.paper },
    ],
  },
  {
    a: 3,
    b: 6,
    daysAgo: 19,
    rounds: [
      // chunli beats dan 2-0
      { moveA: M.paper, moveB: M.rock },
      { moveA: M.rock, moveB: M.scissors },
    ],
  },
  // ── Week 2 ───────────────────────────────────────────────────────────────
  {
    a: 1,
    b: 5,
    daysAgo: 18,
    rounds: [
      // sakura beats blanka 2-0
      { moveA: M.scissors, moveB: M.paper },
      { moveA: M.rock, moveB: M.scissors },
    ],
  },
  {
    a: 0,
    b: 2,
    daysAgo: 17,
    rounds: [
      // ryu beats ken 2-1 (close!)
      { moveA: M.rock, moveB: M.paper }, //   B wins round
      { moveA: M.scissors, moveB: M.paper }, //   A wins round (scissors>paper)
      { moveA: M.paper, moveB: M.rock }, //   A wins round → 2-1
    ],
  },
  {
    a: 5,
    b: 7,
    daysAgo: 16,
    rounds: [
      // blanka beats birdie 2-0
      { moveA: M.rock, moveB: M.scissors },
      { moveA: M.paper, moveB: M.rock },
    ],
  },
  {
    a: 2,
    b: 4,
    daysAgo: 15,
    rounds: [
      // ken beats zangief 2-0
      { moveA: M.rock, moveB: M.scissors },
      { moveA: M.paper, moveB: M.rock },
    ],
  },
  {
    a: 1,
    b: 3,
    daysAgo: 14,
    rounds: [
      // sakura beats chunli 2-1
      { moveA: M.rock, moveB: M.scissors }, //   A wins round
      { moveA: M.paper, moveB: M.scissors }, //   B wins round (scissors>paper)
      { moveA: M.scissors, moveB: M.paper }, //   A wins round → 2-1
    ],
  },
  // ── Week 1 ───────────────────────────────────────────────────────────────
  {
    a: 0,
    b: 3,
    daysAgo: 13,
    rounds: [
      // ryu beats chunli 2-0
      { moveA: M.scissors, moveB: M.paper },
      { moveA: M.paper, moveB: M.rock },
    ],
  },
  {
    a: 6,
    b: 7,
    daysAgo: 12,
    rounds: [
      // dan beats birdie 2-0 (dan's only win!)
      { moveA: M.rock, moveB: M.scissors },
      { moveA: M.scissors, moveB: M.paper },
    ],
  },
  {
    a: 4,
    b: 5,
    daysAgo: 11,
    rounds: [
      // zangief beats blanka 2-0
      { moveA: M.paper, moveB: M.rock },
      { moveA: M.scissors, moveB: M.paper },
    ],
  },
  {
    a: 0,
    b: 1,
    daysAgo: 10,
    rounds: [
      // ryu beats sakura 2-1 (rivalry!)
      { moveA: M.scissors, moveB: M.paper }, //   A wins round
      { moveA: M.paper, moveB: M.scissors }, //   B wins round (scissors>paper)
      { moveA: M.rock, moveB: M.scissors }, //   A wins round → 2-1
    ],
  },
  {
    a: 2,
    b: 3,
    daysAgo: 9,
    rounds: [
      // ken beats chunli 2-0
      { moveA: M.rock, moveB: M.scissors },
      { moveA: M.paper, moveB: M.rock },
    ],
  },
  {
    a: 1,
    b: 2,
    daysAgo: 8,
    rounds: [
      // sakura beats ken 2-0
      { moveA: M.rock, moveB: M.scissors },
      { moveA: M.scissors, moveB: M.paper },
    ],
  },
  {
    a: 0,
    b: 4,
    daysAgo: 7,
    rounds: [
      // ryu beats zangief 2-0
      { moveA: M.scissors, moveB: M.paper },
      { moveA: M.paper, moveB: M.rock },
    ],
  },
  {
    a: 3,
    b: 7,
    daysAgo: 6,
    rounds: [
      // chunli beats birdie 2-0
      { moveA: M.paper, moveB: M.rock },
      { moveA: M.scissors, moveB: M.paper },
    ],
  },
  {
    a: 5,
    b: 6,
    daysAgo: 5,
    rounds: [
      // blanka beats dan 2-0
      { moveA: M.rock, moveB: M.scissors },
      { moveA: M.paper, moveB: M.rock },
    ],
  },
  {
    a: 0,
    b: 2,
    daysAgo: 4,
    rounds: [
      // ryu beats ken 2-1 (rematch)
      { moveA: M.rock, moveB: M.scissors }, //   A wins round
      { moveA: M.scissors, moveB: M.rock }, //   B wins round (rock>scissors)
      { moveA: M.paper, moveB: M.rock }, //   A wins round → 2-1
    ],
  },
  {
    a: 1,
    b: 0,
    daysAgo: 3,
    rounds: [
      // sakura beats ryu 2-0 (revenge!)
      { moveA: M.paper, moveB: M.rock },
      { moveA: M.scissors, moveB: M.paper },
    ],
  },
  {
    a: 2,
    b: 1,
    daysAgo: 2,
    rounds: [
      // ken beats sakura 2-1
      { moveA: M.rock, moveB: M.scissors }, //   A wins round
      { moveA: M.paper, moveB: M.scissors }, //   B wins round (scissors>paper)
      { moveA: M.scissors, moveB: M.paper }, //   A wins round → 2-1
    ],
  },
  {
    a: 0,
    b: 1,
    daysAgo: 1,
    rounds: [
      // ryu beats sakura 2-0 (final showdown)
      { moveA: M.rock, moveB: M.scissors },
      { moveA: M.scissors, moveB: M.paper },
    ],
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const existing = await prisma.user.findFirst({
    where: { email: `ryu${DEMO_DOMAIN}` },
    select: { id: true },
  });

  if (existing && !FORCE) {
    console.log("Demo data already exists. Run with --force to recreate it.");
    return;
  }

  if (existing) {
    console.log("Deleting existing demo data…");
    await prisma.user.deleteMany({ where: { email: { endsWith: DEMO_DOMAIN } } });
  }

  console.log("Hashing demo password…");
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  console.log(`Creating ${PLAYERS.length} demo players…`);
  const userIds: string[] = [];
  for (const p of PLAYERS) {
    const user = await prisma.user.create({
      data: {
        email: p.email,
        displayName: p.displayName,
        passwordHash,
        role: UserRole.player,
        eloRating: { create: { rating: 1000, gamesPlayed: 0 } },
      },
      select: { id: true },
    });
    userIds.push(user.id);
  }

  // Live ELO state (updated as matches are processed in chronological order)
  const ratings = new Array<number>(PLAYERS.length).fill(1000);
  const games = new Array<number>(PLAYERS.length).fill(0);

  console.log(`Creating ${MATCHES.length} demo matches…`);
  const now = Date.now();

  for (const def of MATCHES) {
    const playerAId = userIds[def.a];
    const playerBId = userIds[def.b];
    const ratingA = ratings[def.a];
    const ratingB = ratings[def.b];

    // Score from round results
    let scoreA = 0;
    let scoreB = 0;
    for (const r of def.rounds) {
      const w = resolveRound(r.moveA, r.moveB);
      if (w === RoundWinner.a) scoreA++;
      else if (w === RoundWinner.b) scoreB++;
    }

    const outcome = scoreA > scoreB ? "a" : scoreB > scoreA ? "b" : "draw";
    const winnerId = outcome === "a" ? playerAId : outcome === "b" ? playerBId : null;
    const { deltaA, deltaB } = eloDeltas(ratingA, ratingB, outcome);

    const matchDurationMs = 3 * 60_000 + Math.floor(Math.random() * 7 * 60_000);
    const endedAt = new Date(now - def.daysAgo * 24 * 60 * 60_000);
    const startedAt = new Date(endedAt.getTime() - matchDurationMs);
    const roundSlice = Math.floor(matchDurationMs / def.rounds.length);

    await prisma.match.create({
      data: {
        id: randomUUID(),
        playerAId,
        playerBId,
        winnerId,
        scoreA,
        scoreB,
        startedAt,
        endedAt,
        status: MatchStatus.ended,
        rounds: {
          create: def.rounds.map((r, i) => {
            const nonceA = randomHex();
            const nonceB = randomHex();
            return {
              id: randomUUID(),
              roundNumber: i + 1,
              moveA: r.moveA,
              moveB: r.moveB,
              nonceA,
              nonceB,
              commitA: fakeCommit(r.moveA, nonceA),
              commitB: fakeCommit(r.moveB, nonceB),
              winner: resolveRound(r.moveA, r.moveB),
              resolvedAt: new Date(startedAt.getTime() + (i + 1) * roundSlice),
            };
          }),
        },
        eloHistory: {
          create: [
            {
              id: randomUUID(),
              userId: playerAId,
              ratingBefore: ratingA,
              ratingAfter: ratingA + deltaA,
              delta: deltaA,
            },
            {
              id: randomUUID(),
              userId: playerBId,
              ratingBefore: ratingB,
              ratingAfter: ratingB + deltaB,
              delta: deltaB,
            },
          ],
        },
      },
    });

    ratings[def.a] += deltaA;
    ratings[def.b] += deltaB;
    games[def.a]++;
    games[def.b]++;
  }

  console.log("Flushing ELO ratings…");
  for (let i = 0; i < PLAYERS.length; i++) {
    await prisma.eloRating.update({
      where: { userId: userIds[i] },
      data: { rating: ratings[i], gamesPlayed: games[i] },
    });
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Demo seed complete
  Password (all demo accounts): ${DEMO_PASSWORD}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Rank  Player            ELO    G  W  L
`);

  // Print leaderboard sorted by rating desc
  const entries = PLAYERS.map((p, i) => ({
    name: p.displayName,
    email: p.email,
    rating: ratings[i],
    g: games[i],
  }));
  entries.sort((x, y) => y.rating - x.rating);
  entries.forEach((e, rank) => {
    const wins = MATCHES.filter(
      (m) =>
        (m.a === PLAYERS.findIndex((p) => p.displayName === e.name) &&
          ["a"].includes(
            (() => {
              let sA = 0,
                sB = 0;
              for (const r of m.rounds) {
                const w = resolveRound(r.moveA, r.moveB);
                if (w === RoundWinner.a) sA++;
                else if (w === RoundWinner.b) sB++;
              }
              return sA > sB ? "a" : "b";
            })(),
          )) ||
        (m.b === PLAYERS.findIndex((p) => p.displayName === e.name) &&
          ["b"].includes(
            (() => {
              let sA = 0,
                sB = 0;
              for (const r of m.rounds) {
                const w = resolveRound(r.moveA, r.moveB);
                if (w === RoundWinner.a) sA++;
                else if (w === RoundWinner.b) sB++;
              }
              return sA > sB ? "a" : "b";
            })(),
          )),
    ).length;
    const losses = e.g - wins;
    console.log(
      `  ${String(rank + 1).padStart(4)}  ${e.name.padEnd(16)}  ${String(e.rating).padStart(4)}   ${e.g}  ${wins}  ${losses}`,
    );
  });
  console.log("");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
