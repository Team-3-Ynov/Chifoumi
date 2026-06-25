import { Inject, Injectable } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import { validate as uuidValidate, v4 as uuidv4 } from "uuid";
import { MatchPlayService } from "../match/match-play.service.js";
import { MatchSessionService } from "../match-session/match-session.service.js";
import {
  MATCH_SESSION_TTL_SECONDS,
  type MatchPlayer,
  userMatchKey,
} from "../match-session/match-session.types.js";
import {
  MATCH_BY_USER_PREFIX,
  MATCHMAKING_PAIR_LOCK_TTL_SECONDS,
  MATCHMAKING_QUEUE_KEY,
  matchmakingPairLockKey,
} from "../matchmaking/matchmaking.constants.js";
import { RatingService } from "../matchmaking/rating.service.js";
import { RedisService } from "../redis/redis.service.js";
import { CLAIM_DIRECTED_PLAYERS_SCRIPT } from "./directed-match.constants.js";

export type DirectedMatchPlayer = {
  userId: string;
  displayName: string;
};

export type StartDirectedMatchInput = {
  tournamentMatchId: string;
  slotA: DirectedMatchPlayer;
  slotB: DirectedMatchPlayer;
};

export type StartDirectedMatchErrorCode =
  | "SAME_PLAYER"
  | "PLAYER_ALREADY_IN_MATCH"
  | "INVALID_PLAYER"
  | "INVALID_TOURNAMENT_MATCH";

export type StartDirectedMatchResult =
  | { ok: true; matchId: string }
  | { ok: false; code: StartDirectedMatchErrorCode };

@Injectable()
export class DirectedMatchService {
  constructor(
    @Inject(RedisService) private readonly redisService: RedisService,
    @Inject(RatingService) private readonly ratingService: RatingService,
    @Inject(MatchSessionService) private readonly matchSessionService: MatchSessionService,
    @Inject(MatchPlayService) private readonly matchPlayService: MatchPlayService,
    @Inject(Logger) private readonly logger: Logger,
  ) {}

  async startMatch(input: StartDirectedMatchInput): Promise<StartDirectedMatchResult> {
    if (input.slotA.userId === input.slotB.userId) {
      return { ok: false, code: "SAME_PLAYER" };
    }

    if (!this.isValidPlayer(input.slotA) || !this.isValidPlayer(input.slotB)) {
      return { ok: false, code: "INVALID_PLAYER" };
    }

    const tournamentMatchId = input.tournamentMatchId.trim();
    if (tournamentMatchId.length === 0 || !uuidValidate(tournamentMatchId)) {
      return { ok: false, code: "INVALID_TOURNAMENT_MATCH" };
    }

    const [playerA, playerB] = await Promise.all([
      this.toMatchPlayer(input.slotA),
      this.toMatchPlayer(input.slotB),
    ]);

    const matchId = uuidv4();
    const claimed = await this.claimPlayers(playerA.userId, playerB.userId, matchId);
    if (!claimed) {
      return { ok: false, code: "PLAYER_ALREADY_IN_MATCH" };
    }

    try {
      const state = await this.matchSessionService.create({
        players: [playerA, playerB],
        matchId,
        tournamentMatchId,
      });

      await this.matchPlayService.onMatchStarted(state);

      this.logger.log(
        {
          matchId: state.matchId,
          tournamentMatchId,
          slotA: input.slotA.userId,
          slotB: input.slotB.userId,
        },
        "directed tournament match created",
      );

      return { ok: true, matchId: state.matchId };
    } catch (error) {
      await this.releasePlayerClaims(playerA.userId, playerB.userId);
      throw error;
    }
  }

  private isValidPlayer(player: DirectedMatchPlayer): boolean {
    return player.userId.trim().length > 0 && player.displayName.trim().length > 0;
  }

  private async claimPlayers(userA: string, userB: string, matchId: string): Promise<boolean> {
    const pairLockKey = matchmakingPairLockKey(userA, userB);
    const lockAcquired = await this.redisService.setnx(
      pairLockKey,
      MATCHMAKING_PAIR_LOCK_TTL_SECONDS,
    );
    if (!lockAcquired) {
      return false;
    }

    const claimed = await this.redisService.evalScript<number>(
      CLAIM_DIRECTED_PLAYERS_SCRIPT,
      [MATCHMAKING_QUEUE_KEY],
      [pairLockKey, matchId, userA, userB, MATCH_BY_USER_PREFIX, String(MATCH_SESSION_TTL_SECONDS)],
    );

    return claimed === 1;
  }

  private async releasePlayerClaims(userA: string, userB: string): Promise<void> {
    await Promise.all([
      this.redisService.del(userMatchKey(userA)),
      this.redisService.del(userMatchKey(userB)),
    ]);
  }

  private async toMatchPlayer(player: DirectedMatchPlayer): Promise<MatchPlayer> {
    const rating = await this.ratingService.getRating(player.userId);
    return {
      userId: player.userId,
      displayName: player.displayName,
      rating,
    };
  }
}
