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
  MATCHMAKING_META_PREFIX,
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
  | "INVALID_TOURNAMENT_MATCH"
  | "TOURNAMENT_MATCH_ALREADY_STARTED";

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
    const claim = await this.claimPlayers(
      playerA.userId,
      playerB.userId,
      tournamentMatchId,
      matchId,
    );
    if (claim === "tournament_already_started") {
      return this.resolveExistingTournamentMatch(tournamentMatchId, playerA.userId, playerB.userId);
    }
    if (claim === "players_busy") {
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
      await this.releaseClaims(playerA.userId, playerB.userId, tournamentMatchId);
      throw error;
    }
  }

  private isValidPlayer(player: DirectedMatchPlayer): boolean {
    return player.userId.trim().length > 0 && player.displayName.trim().length > 0;
  }

  private async claimPlayers(
    userA: string,
    userB: string,
    tournamentMatchId: string,
    matchId: string,
  ): Promise<"claimed" | "players_busy" | "tournament_already_started"> {
    const pairLockKey = matchmakingPairLockKey(userA, userB);
    const lockAcquired = await this.redisService.setnx(
      pairLockKey,
      MATCHMAKING_PAIR_LOCK_TTL_SECONDS,
    );
    if (!lockAcquired) {
      return "players_busy";
    }

    const claimed = await this.redisService.evalScript<number>(
      CLAIM_DIRECTED_PLAYERS_SCRIPT,
      [MATCHMAKING_QUEUE_KEY],
      [
        pairLockKey,
        matchId,
        userA,
        userB,
        MATCH_BY_USER_PREFIX,
        MATCHMAKING_META_PREFIX,
        tournamentMatchKey(tournamentMatchId),
        String(MATCH_SESSION_TTL_SECONDS),
      ],
    );

    if (claimed === 1) {
      return "claimed";
    }
    if (claimed === 2) {
      return "tournament_already_started";
    }
    return "players_busy";
  }

  private async resolveExistingTournamentMatch(
    tournamentMatchId: string,
    userA: string,
    userB: string,
  ): Promise<StartDirectedMatchResult> {
    const existingMatchId = await this.redisService.get(tournamentMatchKey(tournamentMatchId));
    if (!existingMatchId) {
      return { ok: false, code: "TOURNAMENT_MATCH_ALREADY_STARTED" };
    }

    const [userAMatchId, userBMatchId] = await Promise.all([
      this.redisService.get(userMatchKey(userA)),
      this.redisService.get(userMatchKey(userB)),
    ]);

    if (userAMatchId === existingMatchId && userBMatchId === existingMatchId) {
      return { ok: true, matchId: existingMatchId };
    }

    return { ok: false, code: "TOURNAMENT_MATCH_ALREADY_STARTED" };
  }

  private async releaseClaims(
    userA: string,
    userB: string,
    tournamentMatchId: string,
  ): Promise<void> {
    await Promise.all([
      this.redisService.del(userMatchKey(userA)),
      this.redisService.del(userMatchKey(userB)),
      this.redisService.del(tournamentMatchKey(tournamentMatchId)),
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

function tournamentMatchKey(tournamentMatchId: string): string {
  return `tournament-match:${tournamentMatchId}:match`;
}
