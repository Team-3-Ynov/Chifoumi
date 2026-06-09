import { Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { RedisService } from "../redis/redis.service.js";
import { MatchEventBus } from "./match-event-bus.js";
import {
  MATCH_LOCK_TTL_SECONDS,
  MATCH_SESSION_TTL_SECONDS,
  type MatchPlayer,
  type MatchState,
  matchLockKey,
  matchStateKey,
  ROUND_DEADLINE_MS,
  userMatchKey,
} from "./match-session.types.js";

export class MatchSessionNotFoundError extends Error {
  constructor(matchId: string) {
    super(`Match session not found: ${matchId}`);
    this.name = "MatchSessionNotFoundError";
  }
}

export class MatchSessionLockError extends Error {
  constructor(matchId: string) {
    super(`Match session is locked: ${matchId}`);
    this.name = "MatchSessionLockError";
  }
}

@Injectable()
export class MatchSessionService {
  constructor(
    private readonly redis: RedisService,
    private readonly eventBus: MatchEventBus,
  ) {}

  async create(input: {
    players: [MatchPlayer, MatchPlayer];
    matchId?: string;
    now?: Date;
  }): Promise<MatchState> {
    const now = input.now ?? new Date();
    const matchId = input.matchId ?? uuidv4();
    const state: MatchState = {
      matchId,
      players: input.players,
      scoreA: 0,
      scoreB: 0,
      currentRound: 1,
      status: "WAITING_PLAYS",
      startedAt: now.toISOString(),
      roundDeadline: new Date(now.getTime() + ROUND_DEADLINE_MS).toISOString(),
    };

    await this.saveState(state);
    await Promise.all(
      input.players.map((player) =>
        this.redis.setex(userMatchKey(player.userId), MATCH_SESSION_TTL_SECONDS, matchId),
      ),
    );
    await this.broadcastInitialEvents(state);

    return state;
  }

  async loadState(matchId: string): Promise<MatchState | null> {
    const serialized = await this.redis.get(matchStateKey(matchId));
    if (!serialized) {
      return null;
    }
    return JSON.parse(serialized) as MatchState;
  }

  async mutateState(
    matchId: string,
    mutator: (state: MatchState) => MatchState | Promise<MatchState>,
  ): Promise<MatchState> {
    const lockKey = matchLockKey(matchId);
    const lockAcquired = await this.redis.setnx(lockKey, MATCH_LOCK_TTL_SECONDS, uuidv4());
    if (!lockAcquired) {
      throw new MatchSessionLockError(matchId);
    }

    try {
      const state = await this.loadState(matchId);
      if (!state) {
        throw new MatchSessionNotFoundError(matchId);
      }

      const nextState = await mutator(state);
      await this.saveState(nextState);
      return nextState;
    } finally {
      await this.redis.del(lockKey);
    }
  }

  private async saveState(state: MatchState): Promise<void> {
    await this.redis.setex(
      matchStateKey(state.matchId),
      MATCH_SESSION_TTL_SECONDS,
      JSON.stringify(state),
    );
  }

  private async broadcastInitialEvents(state: MatchState): Promise<void> {
    const [playerA, playerB] = state.players;
    await Promise.all([
      this.eventBus.broadcastToMatch(
        state.matchId,
        "matchFound",
        {
          matchId: state.matchId,
          opponent: playerB,
          bestOf: 3,
        },
        {
          recipientUserId: playerA.userId,
        },
      ),
      this.eventBus.broadcastToMatch(
        state.matchId,
        "matchFound",
        {
          matchId: state.matchId,
          opponent: playerA,
          bestOf: 3,
        },
        {
          recipientUserId: playerB.userId,
        },
      ),
      this.eventBus.broadcastToMatch(state.matchId, "roundStart", {
        matchId: state.matchId,
        roundNumber: state.currentRound,
        deadline: state.roundDeadline,
      }),
    ]);
  }
}
