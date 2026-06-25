import { Inject, Injectable } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import { MatchPlayService } from "../match/match-play.service.js";
import { MatchSessionService } from "../match-session/match-session.service.js";
import type { MatchPlayer } from "../match-session/match-session.types.js";
import { matchByUserKey } from "../matchmaking/matchmaking.constants.js";
import { MatchmakingService } from "../matchmaking/matchmaking.service.js";
import { RatingService } from "../matchmaking/rating.service.js";
import { RedisService } from "../redis/redis.service.js";

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
  | "INVALID_PLAYER";

export type StartDirectedMatchResult =
  | { ok: true; matchId: string }
  | { ok: false; code: StartDirectedMatchErrorCode };

@Injectable()
export class DirectedMatchService {
  constructor(
    @Inject(RedisService) private readonly redisService: RedisService,
    @Inject(MatchmakingService) private readonly matchmakingService: MatchmakingService,
    @Inject(RatingService) private readonly ratingService: RatingService,
    @Inject(MatchSessionService) private readonly matchSessionService: MatchSessionService,
    @Inject(MatchPlayService) private readonly matchPlayService: MatchPlayService,
    @Inject(Logger) private readonly logger: Logger,
  ) {}

  async startMatch(input: StartDirectedMatchInput): Promise<StartDirectedMatchResult> {
    if (input.slotA.userId === input.slotB.userId) {
      return { ok: false, code: "SAME_PLAYER" };
    }

    if (
      !this.isValidPlayer(input.slotA) ||
      !this.isValidPlayer(input.slotB) ||
      input.tournamentMatchId.trim().length === 0
    ) {
      return { ok: false, code: "INVALID_PLAYER" };
    }

    const busyCheck = await this.ensurePlayersAvailable(input.slotA.userId, input.slotB.userId);
    if (!busyCheck.ok) {
      return busyCheck;
    }

    const [playerA, playerB] = await Promise.all([
      this.toMatchPlayer(input.slotA),
      this.toMatchPlayer(input.slotB),
    ]);

    const state = await this.matchSessionService.create({
      players: [playerA, playerB],
      tournamentMatchId: input.tournamentMatchId,
    });

    await this.matchPlayService.onMatchStarted(state);

    this.logger.log(
      {
        matchId: state.matchId,
        tournamentMatchId: input.tournamentMatchId,
        slotA: input.slotA.userId,
        slotB: input.slotB.userId,
      },
      "directed tournament match created",
    );

    return { ok: true, matchId: state.matchId };
  }

  private isValidPlayer(player: DirectedMatchPlayer): boolean {
    return player.userId.trim().length > 0 && player.displayName.trim().length > 0;
  }

  private async ensurePlayersAvailable(
    userA: string,
    userB: string,
  ): Promise<{ ok: true } | { ok: false; code: "PLAYER_ALREADY_IN_MATCH" }> {
    const [matchA, matchB] = await Promise.all([
      this.redisService.get(matchByUserKey(userA)),
      this.redisService.get(matchByUserKey(userB)),
    ]);

    if (matchA || matchB) {
      return { ok: false, code: "PLAYER_ALREADY_IN_MATCH" };
    }

    const [inQueueA, inQueueB] = await Promise.all([
      this.matchmakingService.isInQueue(userA),
      this.matchmakingService.isInQueue(userB),
    ]);

    if (inQueueA || inQueueB) {
      return { ok: false, code: "PLAYER_ALREADY_IN_MATCH" };
    }

    return { ok: true };
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
