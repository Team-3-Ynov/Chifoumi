import { forwardRef, Inject, Injectable } from "@nestjs/common";
import { MatchSessionService } from "../match-session/match-session.service.js";
import {
  type MatchResumedCurrentState,
  type MatchResumedPayload,
  type MatchState,
} from "../match-session/match-session.types.js";
import { MatchmakingService } from "../matchmaking/matchmaking.service.js";
import { RedisService } from "../redis/redis.service.js";
import { MatchDisconnectSchedulerService } from "./match-disconnect-scheduler.service.js";
import { MatchReconnectMetricsService } from "./match-reconnect-metrics.service.js";

@Injectable()
export class MatchReconnectService {
  constructor(
    @Inject(forwardRef(() => MatchmakingService))
    private readonly matchmakingService: MatchmakingService,
    @Inject(MatchSessionService) private readonly matchSessionService: MatchSessionService,
    @Inject(MatchDisconnectSchedulerService)
    private readonly matchDisconnectScheduler: MatchDisconnectSchedulerService,
    @Inject(MatchReconnectMetricsService)
    private readonly matchReconnectMetrics: MatchReconnectMetricsService,
    @Inject(RedisService) private readonly redisService: RedisService,
  ) {}

  async handleDisconnect(userId: string, socketId: string): Promise<void> {
    if (await this.matchmakingService.isInMatch(userId)) {
      const matchId = await this.matchmakingService.getMatchIdForUser(userId);
      if (matchId) {
        const removedActiveSocket = await this.redisService.removeUserSocket(userId, socketId);
        if (removedActiveSocket) {
          await this.matchDisconnectScheduler.scheduleForfeit(userId, matchId);
        }
      }
      return;
    }

    await this.matchmakingService.leaveQueue(userId);
    await this.redisService.removeUserSocket(userId, socketId);
  }

  async handleReconnect(userId: string): Promise<MatchResumedPayload | null> {
    const matchId = await this.matchmakingService.getMatchIdForUser(userId);
    if (!matchId) {
      return null;
    }

    const state = await this.matchSessionService.loadState(matchId);
    if (!state || state.status === "ENDED") {
      return null;
    }

    const resumed = buildMatchResumedPayload(state);
    if (!resumed) {
      return null;
    }

    await this.matchDisconnectScheduler.cancelForfeit(userId);
    this.matchReconnectMetrics.recordResumed();
    return resumed;
  }
}

function buildMatchResumedPayload(state: MatchState): MatchResumedPayload | null {
  const currentState = toResumedCurrentState(state);
  if (!currentState) {
    return null;
  }

  const deadline =
    currentState === "WAITING_REVEALS" && state.revealDeadline
      ? state.revealDeadline
      : state.roundDeadline;

  return {
    matchId: state.matchId,
    currentRound: state.currentRound,
    scoreA: state.scoreA,
    scoreB: state.scoreB,
    currentState,
    deadline,
  };
}

function toResumedCurrentState(state: MatchState): MatchResumedCurrentState | null {
  if (state.status === "WAITING_PLAYS") {
    return "WAITING_PLAYS";
  }
  if (state.status === "WAITING_COMMITS") {
    return "WAITING_COMMITS";
  }
  if (state.status === "WAITING_REVEALS") {
    return "WAITING_REVEALS";
  }
  if (state.status === "RESOLVING") {
    return "WAITING_PLAYS";
  }
  return null;
}
