import { TournamentStatus, WinnerSlot } from "@chifoumi/db";
import { describe, expect, it, jest } from "@jest/globals";
import { TournamentMatchReadyService } from "./tournament-match-ready.service.js";
import { TournamentProgressionService } from "./tournament-progression.service.js";

const tournamentId = "99999999-9999-4999-8999-999999999999";
const tournamentName = "Spring Cup";

const playerA = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "alice",
  email: "alice@test.com",
};
const playerB = {
  id: "22222222-2222-4222-8222-222222222222",
  displayName: "bob",
  email: "bob@test.com",
};
const playerC = {
  id: "33333333-3333-4333-8333-333333333333",
  displayName: "carol",
  email: "carol@test.com",
};
const playerD = {
  id: "44444444-4444-4444-8444-444444444444",
  displayName: "dave",
  email: "dave@test.com",
};

type BracketMatch = {
  id: string;
  tournamentId: string;
  round: number;
  positionIndex: number;
  matchId: string | null;
  slotAId: string | null;
  slotBId: string | null;
  nextMatchId: string | null;
  winnerSlot: WinnerSlot | null;
  tournament: {
    id: string;
    name: string;
    status: TournamentStatus;
  };
};

function createFourPlayerBracket(): BracketMatch[] {
  const semiA: BracketMatch = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    tournamentId,
    round: 1,
    positionIndex: 0,
    matchId: "match-semi-a",
    slotAId: playerA.id,
    slotBId: playerB.id,
    nextMatchId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    winnerSlot: null,
    tournament: { id: tournamentId, name: tournamentName, status: TournamentStatus.in_progress },
  };
  const semiB: BracketMatch = {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    tournamentId,
    round: 1,
    positionIndex: 1,
    matchId: "match-semi-b",
    slotAId: playerC.id,
    slotBId: playerD.id,
    nextMatchId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    winnerSlot: null,
    tournament: { id: tournamentId, name: tournamentName, status: TournamentStatus.in_progress },
  };
  const finalMatch: BracketMatch = {
    id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    tournamentId,
    round: 2,
    positionIndex: 0,
    matchId: null,
    slotAId: null,
    slotBId: null,
    nextMatchId: null,
    winnerSlot: null,
    tournament: { id: tournamentId, name: tournamentName, status: TournamentStatus.in_progress },
  };

  return [semiA, semiB, finalMatch];
}

function createEightPlayerRoundOneMatch(
  id: string,
  positionIndex: number,
  slotAId: string,
  slotBId: string | null,
  nextMatchId: string,
  winnerSlot: WinnerSlot | null = null,
): BracketMatch {
  return {
    id,
    tournamentId,
    round: 1,
    positionIndex,
    matchId: slotBId ? `match-${id}` : null,
    slotAId,
    slotBId,
    nextMatchId,
    winnerSlot,
    tournament: { id: tournamentId, name: tournamentName, status: TournamentStatus.in_progress },
  };
}

function createService(
  matches: BracketMatch[],
  overrides: {
    notificationsQueue?: Record<string, unknown>;
    tournamentMatchReady?: Record<string, unknown>;
    users?: Record<string, { email: string; displayName: string }>;
  } = {},
) {
  const matchById = new Map(matches.map((match) => [match.id, { ...match }]));
  const matchByMatchId = new Map(
    matches.filter((match) => match.matchId).map((match) => [match.matchId as string, match.id]),
  );

  const tournamentMatch = {
    findUnique: jest.fn(
      async ({ where, include }: { where: { id?: string }; include?: unknown }) => {
        const match = where.id ? matchById.get(where.id) : undefined;
        if (!match) {
          return null;
        }

        return hydrateMatch(match, include, overrides.users);
      },
    ),
    findFirst: jest.fn(
      async ({ where, include }: { where: { matchId?: string }; include?: unknown }) => {
        const matchId = where.matchId ? matchByMatchId.get(where.matchId) : undefined;
        const match = matchId ? matchById.get(matchId) : undefined;
        if (!match) {
          return null;
        }

        return hydrateMatch(match, include, overrides.users);
      },
    ),
    findMany: jest.fn(async ({ where }: { where: { nextMatchId?: string } }) => {
      return [...matchById.values()]
        .filter((match) => match.nextMatchId === where.nextMatchId)
        .map((match) => ({ id: match.id }));
    }),
    update: jest.fn(
      async ({ where, data }: { where: { id: string }; data: Partial<BracketMatch> }) => {
        const current = matchById.get(where.id);
        if (!current) {
          throw new Error(`Missing match ${where.id}`);
        }

        const updated = { ...current, ...data };
        matchById.set(where.id, updated);
        if (updated.matchId) {
          matchByMatchId.set(updated.matchId, updated.id);
        }

        return updated;
      },
    ),
  };

  const tournament = {
    update: jest.fn(
      async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        for (const match of matchById.values()) {
          if (match.tournamentId === where.id) {
            match.tournament = { ...match.tournament, ...(data as typeof match.tournament) };
          }
        }

        return { id: where.id, ...data };
      },
    ),
  };

  const user = {
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
      const users: Record<string, { email: string; displayName: string }> = {
        [playerA.id]: { email: playerA.email, displayName: playerA.displayName },
        [playerB.id]: { email: playerB.email, displayName: playerB.displayName },
        [playerC.id]: { email: playerC.email, displayName: playerC.displayName },
        [playerD.id]: { email: playerD.email, displayName: playerD.displayName },
        ...overrides.users,
      };

      return users[where.id] ?? null;
    }),
  };

  const prisma = {
    tournamentMatch,
    tournament,
    user,
    $transaction: jest.fn(async (callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback(prisma),
    ),
  };

  const notificationsQueue = {
    enqueueTournamentCompletedMail: jest.fn(async () => undefined),
    ...overrides.notificationsQueue,
  };

  const tournamentMatchReady = {
    notifyPlayersMatchReady: jest.fn(async () => undefined),
    ...overrides.tournamentMatchReady,
  };

  const service = new TournamentProgressionService(
    prisma as never,
    notificationsQueue as never,
    tournamentMatchReady as never,
  );

  return { service, prisma, notificationsQueue, tournamentMatchReady, matchById };
}

function hydrateMatch(
  match: BracketMatch,
  include: unknown,
  users: Record<string, { email: string; displayName: string }> | undefined,
) {
  if (!include) {
    return match;
  }

  const slotUsers = {
    [playerA.id]: playerA,
    [playerB.id]: playerB,
    [playerC.id]: playerC,
    [playerD.id]: playerD,
  };

  return {
    ...match,
    slotA: match.slotAId
      ? {
          id: match.slotAId,
          displayName: users?.[match.slotAId]?.displayName ?? slotUsers[match.slotAId]?.displayName,
          email: users?.[match.slotAId]?.email ?? slotUsers[match.slotAId]?.email,
        }
      : null,
    slotB: match.slotBId
      ? {
          id: match.slotBId,
          displayName: users?.[match.slotBId]?.displayName ?? slotUsers[match.slotBId]?.displayName,
          email: users?.[match.slotBId]?.email ?? slotUsers[match.slotBId]?.email,
        }
      : null,
  };
}

describe("TournamentProgressionService", () => {
  it("returns not_tournament_match when no tournament match is linked", async () => {
    const { service } = createService([]);

    await expect(
      service.processMatchEnded({
        matchId: "00000000-0000-4000-8000-000000000000",
        winnerId: playerA.id,
      }),
    ).resolves.toBe("not_tournament_match");
  });

  it("advances the winner into the next match slot for a 4-player bracket", async () => {
    const { service, matchById, tournamentMatchReady } = createService(createFourPlayerBracket());

    await expect(
      service.processMatchEnded({ matchId: "match-semi-a", winnerId: playerA.id }),
    ).resolves.toBe("advanced");

    const finalMatch = matchById.get("ffffffff-ffff-4fff-8fff-ffffffffffff");
    expect(finalMatch?.slotAId).toBe(playerA.id);
    expect(finalMatch?.slotBId).toBeNull();
    expect(matchById.get("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")?.winnerSlot).toBe(WinnerSlot.a);
    expect(tournamentMatchReady.notifyPlayersMatchReady).not.toHaveBeenCalled();
  });

  it("places winners in the correct parent slot when feeders complete out of order", async () => {
    const { service, matchById } = createService(createFourPlayerBracket());

    await service.processMatchEnded({ matchId: "match-semi-b", winnerId: playerC.id });

    const finalAfterSemiB = matchById.get("ffffffff-ffff-4fff-8fff-ffffffffffff");
    expect(finalAfterSemiB?.slotAId).toBeNull();
    expect(finalAfterSemiB?.slotBId).toBe(playerC.id);

    await service.processMatchEnded({ matchId: "match-semi-a", winnerId: playerA.id });

    const finalMatch = matchById.get("ffffffff-ffff-4fff-8fff-ffffffffffff");
    expect(finalMatch?.slotAId).toBe(playerA.id);
    expect(finalMatch?.slotBId).toBe(playerC.id);
  });

  it("notifies both players when the next match becomes ready", async () => {
    const { service, tournamentMatchReady } = createService(createFourPlayerBracket());

    await service.processMatchEnded({ matchId: "match-semi-a", winnerId: playerA.id });
    await service.processMatchEnded({ matchId: "match-semi-b", winnerId: playerC.id });

    expect(tournamentMatchReady.notifyPlayersMatchReady).toHaveBeenCalledTimes(1);
    expect(tournamentMatchReady.notifyPlayersMatchReady).toHaveBeenCalledWith({
      tournamentMatchId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      tournamentName,
      slotA: {
        userId: playerA.id,
        displayName: playerA.displayName,
        email: playerA.email,
      },
      slotB: {
        userId: playerC.id,
        displayName: playerC.displayName,
        email: playerC.email,
      },
    });
  });

  it("crowns the tournament winner when the final match ends", async () => {
    const matches = createFourPlayerBracket();
    const finalMatch = matches[2];
    if (finalMatch) {
      finalMatch.slotAId = playerA.id;
      finalMatch.slotBId = playerC.id;
      finalMatch.matchId = "match-final";
    }

    const { service, matchById, notificationsQueue } = createService(matches);

    await expect(
      service.processMatchEnded({ matchId: "match-final", winnerId: playerA.id }),
    ).resolves.toBe("tournament_completed");

    expect(matchById.get("ffffffff-ffff-4fff-8fff-ffffffffffff")?.winnerSlot).toBe(WinnerSlot.a);
    expect(matchById.get("ffffffff-ffff-4fff-8fff-ffffffffffff")?.tournament.status).toBe(
      TournamentStatus.completed,
    );
    expect(notificationsQueue.enqueueTournamentCompletedMail).toHaveBeenCalledWith({
      to: playerA.email,
      displayName: playerA.displayName,
      tournamentName,
    });
  });

  it("is idempotent when the same match-ended event is replayed", async () => {
    const { service, matchById } = createService(createFourPlayerBracket());

    await service.processMatchEnded({ matchId: "match-semi-a", winnerId: playerA.id });
    await expect(
      service.processMatchEnded({ matchId: "match-semi-a", winnerId: playerA.id }),
    ).resolves.toBe("already_advanced");

    expect(matchById.get("ffffffff-ffff-4fff-8fff-ffffffffffff")?.slotAId).toBe(playerA.id);
  });

  it("handles bye propagation when only one feeder completes in an 8-player bracket", async () => {
    const quarterA = createEightPlayerRoundOneMatch(
      "11111111-1111-4111-8111-111111111111",
      0,
      playerA.id,
      playerB.id,
      "55555555-5555-4555-8555-555555555555",
    );
    const quarterB = createEightPlayerRoundOneMatch(
      "22222222-2222-4222-8222-222222222222",
      1,
      playerC.id,
      null,
      "55555555-5555-4555-8555-555555555555",
      WinnerSlot.a,
    );
    quarterB.slotBId = null;

    const semiA: BracketMatch = {
      id: "55555555-5555-4555-8555-555555555555",
      tournamentId,
      round: 2,
      positionIndex: 0,
      matchId: null,
      slotAId: playerC.id,
      slotBId: null,
      nextMatchId: "66666666-6666-4666-8666-666666666666",
      winnerSlot: null,
      tournament: { id: tournamentId, name: tournamentName, status: TournamentStatus.in_progress },
    };
    const semiB: BracketMatch = {
      id: "33333333-3333-4333-8333-333333333333",
      tournamentId,
      round: 2,
      positionIndex: 1,
      matchId: null,
      slotAId: null,
      slotBId: null,
      nextMatchId: "66666666-6666-4666-8666-666666666666",
      winnerSlot: null,
      tournament: { id: tournamentId, name: tournamentName, status: TournamentStatus.in_progress },
    };
    const finalMatch: BracketMatch = {
      id: "66666666-6666-4666-8666-666666666666",
      tournamentId,
      round: 3,
      positionIndex: 0,
      matchId: null,
      slotAId: null,
      slotBId: null,
      nextMatchId: null,
      winnerSlot: null,
      tournament: { id: tournamentId, name: tournamentName, status: TournamentStatus.in_progress },
    };

    const { service, matchById, tournamentMatchReady } = createService([
      quarterA,
      quarterB,
      semiA,
      semiB,
      finalMatch,
    ]);

    await service.processMatchEnded({
      matchId: "match-11111111-1111-4111-8111-111111111111",
      winnerId: playerA.id,
    });

    const updatedSemi = matchById.get("55555555-5555-4555-8555-555555555555");
    expect(updatedSemi?.slotAId).toBe(playerC.id);
    expect(updatedSemi?.slotBId).toBe(playerA.id);
    expect(tournamentMatchReady.notifyPlayersMatchReady).toHaveBeenCalledTimes(1);
  });

  it("resolves tournament matches by tournamentMatchId when provided", async () => {
    const { service, matchById } = createService(createFourPlayerBracket());

    await expect(
      service.processMatchEnded({
        matchId: "unused-match-id",
        tournamentMatchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        winnerId: playerA.id,
      }),
    ).resolves.toBe("advanced");

    expect(matchById.get("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")?.winnerSlot).toBe(WinnerSlot.a);
  });
});

describe("TournamentMatchReadyService", () => {
  it("enqueues ready notifications for both players", async () => {
    const notificationsQueue = {
      enqueueTournamentMatchReadyMail: jest.fn(async () => undefined),
    };
    const service = new TournamentMatchReadyService(notificationsQueue as never);

    await service.notifyPlayersMatchReady({
      tournamentMatchId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      tournamentName,
      slotA: { userId: playerA.id, displayName: playerA.displayName, email: playerA.email },
      slotB: { userId: playerC.id, displayName: playerC.displayName, email: playerC.email },
    });

    expect(notificationsQueue.enqueueTournamentMatchReadyMail).toHaveBeenCalledTimes(2);
  });
});
