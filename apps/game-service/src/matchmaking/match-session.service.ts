import { Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { RedisService } from "../redis/redis.service.js";
import {
  MATCH_BY_USER_TTL_SECONDS,
  MATCH_STATE_TTL_SECONDS,
  matchByUserKey,
  matchStateKey,
} from "./matchmaking.constants.js";

export type MatchPlayer = {
  userId: string;
  displayName: string;
  rating: number;
};

export type MatchState = {
  matchId: string;
  players: [MatchPlayer, MatchPlayer];
  scoreA: number;
  scoreB: number;
  currentRound: number;
  status: "WAITING_PLAYS";
  startedAt: string;
};

@Injectable()
export class MatchSessionService {
  constructor(private readonly redisService: RedisService) {}

  buildMatchState(playerA: MatchPlayer, playerB: MatchPlayer, matchId = uuidv4()): MatchState {
    return {
      matchId,
      players: [playerA, playerB],
      scoreA: 0,
      scoreB: 0,
      currentRound: 1,
      status: "WAITING_PLAYS",
      startedAt: new Date().toISOString(),
    };
  }

  async persistMatchState(state: MatchState): Promise<void> {
    await this.redisService.setex(
      matchStateKey(state.matchId),
      MATCH_STATE_TTL_SECONDS,
      JSON.stringify(state),
    );
    await this.redisService.setex(
      matchByUserKey(state.players[0].userId),
      MATCH_BY_USER_TTL_SECONDS,
      state.matchId,
    );
    await this.redisService.setex(
      matchByUserKey(state.players[1].userId),
      MATCH_BY_USER_TTL_SECONDS,
      state.matchId,
    );
  }

  async getMatchState(matchId: string): Promise<MatchState | null> {
    const raw = await this.redisService.get(matchStateKey(matchId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as MatchState;
  }
}
