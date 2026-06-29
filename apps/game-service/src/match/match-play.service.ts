import { Inject, Injectable } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import { MatchEventBus } from "../match-session/match-event-bus.js";
import {
  MatchSessionLockError,
  MatchSessionService,
} from "../match-session/match-session.service.js";
import {
  emptyRoundPlays,
  type MatchState,
  type Move,
  playerIndex,
  type RoundResolvedPayload,
} from "../match-session/match-session.types.js";
import { transitionMatchState } from "../match-session/match-state-machine.js";
import { MatchmakingMetricsService } from "../matchmaking/matchmaking-metrics.service.js";
import { RedisService } from "../redis/redis.service.js";
import { isValidMove, resolveRound as resolveRps } from "../rps/resolve.js";
import { MatchDisconnectSchedulerService } from "./match-disconnect-scheduler.service.js";
import { MatchEndedPublisher } from "./match-ended-publisher.service.js";
import type { MatchTimeoutExpectedState } from "./match-timeout.types.js";
import { MatchTimeoutSchedulerService } from "./match-timeout-scheduler.service.js";

export type PlayInput = {
  userId: string;
  matchId: string;
  roundNumber: number;
  move: string;
};

export type PlayErrorCode = "WRONG_ROUND" | "INVALID_MOVE" | "NOT_IN_MATCH" | "ALREADY_PLAYED";

export class PlayValidationError extends Error {
  constructor(readonly code: PlayErrorCode) {
    super(code);
    this.name = "PlayValidationError";
  }
}

type RoundResolution = {
  moveA: Move;
  moveB: Move;
  roundNumber: number;
};

type SilentPlayer = "A" | "B" | "BOTH";

@Injectable()
export class MatchPlayService {
  constructor(
    @Inject(MatchSessionService) private readonly matchSessionService: MatchSessionService,
    @Inject(MatchEventBus) private readonly eventBus: MatchEventBus,
    @Inject(MatchEndedPublisher) private readonly matchEndedPublisher: MatchEndedPublisher,
    @Inject(MatchTimeoutSchedulerService)
    private readonly matchTimeoutScheduler: MatchTimeoutSchedulerService,
    @Inject(MatchmakingMetricsService) private readonly metrics: MatchmakingMetricsService,
    @Inject(MatchDisconnectSchedulerService)
    private readonly matchDisconnectScheduler: MatchDisconnectSchedulerService,
    @Inject(RedisService) private readonly redisService: RedisService,
    @Inject(Logger) private readonly logger: Logger,
  ) {}

  async onMatchStarted(state: MatchState): Promise<void> {
    await this.schedulePhaseTimeout(
      state.matchId,
      state.currentRound,
      this.timeoutStateForStatus(state.status),
      state.roundDeadline,
    );
  }

  async submitPlay(input: PlayInput): Promise<void> {
    if (!isValidMove(input.move)) {
      throw new PlayValidationError("INVALID_MOVE");
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const resolved = await this.trySubmitPlay(input);
        if (resolved) {
          await this.afterRoundResolved(resolved.state, resolved.resolution);
        }
        return;
      } catch (error) {
        if (error instanceof MatchSessionLockError && attempt < 4) {
          await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
          continue;
        }
        throw error;
      }
    }
  }

  private async trySubmitPlay(
    input: PlayInput,
  ): Promise<{ state: MatchState; resolution: RoundResolution } | null> {
    const move = input.move as Move;
    let resolution: RoundResolution | null = null;

    const nextState = await this.matchSessionService.mutateState(input.matchId, (state) => {
      const normalized: MatchState = {
        ...state,
        roundPlays: state.roundPlays ?? emptyRoundPlays(),
      };

      const index = playerIndex(normalized, input.userId);
      if (index === null) {
        throw new PlayValidationError("NOT_IN_MATCH");
      }

      if (normalized.status !== "WAITING_PLAYS" || input.roundNumber !== normalized.currentRound) {
        throw new PlayValidationError("WRONG_ROUND");
      }

      const slot = index === 0 ? "a" : "b";
      if (normalized.roundPlays[slot] !== null) {
        throw new PlayValidationError("ALREADY_PLAYED");
      }

      const roundPlays = { ...normalized.roundPlays, [slot]: move };
      const updated: MatchState = { ...normalized, roundPlays };

      if (roundPlays.a === null || roundPlays.b === null) {
        return updated;
      }

      resolution = {
        moveA: roundPlays.a,
        moveB: roundPlays.b,
        roundNumber: normalized.currentRound,
      };

      const resolving = transitionMatchState(updated, { type: "PLAYS_RECEIVED" });
      const winner = resolveRps(roundPlays.a, roundPlays.b);
      const resolvedAt = new Date();
      const winnerLabel = winner === "DRAW" ? "draw" : winner === "A" ? "a" : "b";
      return transitionMatchState(
        {
          ...resolving,
          rounds: [
            ...(normalized.rounds ?? []),
            {
              roundNumber: normalized.currentRound,
              moveA: roundPlays.a,
              moveB: roundPlays.b,
              winner: winnerLabel,
              resolvedAt: resolvedAt.toISOString(),
            },
          ],
        },
        {
          type: "ROUND_RESOLVED",
          winner,
          now: resolvedAt,
        },
      );
    });

    if (!resolution) {
      return null;
    }

    return { state: nextState, resolution };
  }

  async handleMatchTimeout(
    matchId: string,
    roundNumber: number,
    expectedState: MatchTimeoutExpectedState,
  ): Promise<void> {
    if (expectedState === "WAITING_PLAYS") {
      await this.handleRoundTimeout(matchId, roundNumber);
    }
  }

  async handleRoundTimeout(matchId: string, roundNumber: number): Promise<void> {
    const nextState = await this.applyPhaseTimeout(
      matchId,
      roundNumber,
      "WAITING_PLAYS",
      () => "BOTH",
    );

    if (nextState.status === "ENDED") {
      await this.finalizeMatch(nextState);
    }
  }

  async handleDisconnectForfeit(userId: string, matchId: string): Promise<boolean> {
    const activeSocket = await this.redisService.getUserSocket(userId);
    if (activeSocket) {
      return false;
    }

    let forfeited = false;

    const nextState = await this.matchSessionService.mutateState(matchId, (state) => {
      if (state.status === "ENDED") {
        return state;
      }

      const index = playerIndex(state, userId);
      if (index === null) {
        return state;
      }

      const winnerIndex = index === 0 ? 1 : 0;
      forfeited = true;
      return {
        ...state,
        status: "ENDED",
        winnerId: state.players[winnerIndex].userId,
        endReason: "DISCONNECT_FORFEIT",
      };
    });

    if (!forfeited || nextState.status !== "ENDED") {
      return false;
    }

    await this.finalizeMatch(nextState);
    return true;
  }

  private async applyPhaseTimeout(
    matchId: string,
    roundNumber: number,
    expectedStatus: MatchTimeoutExpectedState,
    resolveSilentPlayer: (state: MatchState) => SilentPlayer,
  ): Promise<MatchState> {
    return this.matchSessionService.mutateState(matchId, (state) => {
      if (state.status !== expectedStatus || state.currentRound !== roundNumber) {
        return state;
      }

      const silentPlayer =
        expectedStatus === "WAITING_PLAYS"
          ? this.resolveSilentPlayer(state.roundPlays.a, state.roundPlays.b)
          : resolveSilentPlayer(state);

      const resolvedAt = new Date();

      if (silentPlayer === "BOTH") {
        return transitionMatchState(state, {
          type: "TIMEOUT",
          silentPlayer,
          now: resolvedAt,
        });
      }

      const winnerLabel = silentPlayer === "A" ? "b" : "a";

      if (expectedStatus === "WAITING_PLAYS") {
        return transitionMatchState(
          {
            ...state,
            rounds: [
              ...(state.rounds ?? []),
              {
                roundNumber,
                moveA: state.roundPlays.a,
                moveB: state.roundPlays.b,
                winner: winnerLabel,
                resolvedAt: resolvedAt.toISOString(),
              },
            ],
          },
          {
            type: "TIMEOUT",
            silentPlayer,
            now: resolvedAt,
          },
        );
      }

      return transitionMatchState(state, {
        type: "TIMEOUT",
        silentPlayer,
        now: resolvedAt,
      });
    });
  }

  private resolveSilentPlayer(
    slotA: string | Move | null,
    slotB: string | Move | null,
  ): SilentPlayer {
    if (slotA === null && slotB === null) {
      return "BOTH";
    }
    if (slotA === null && slotB !== null) {
      return "A";
    }
    if (slotB === null && slotA !== null) {
      return "B";
    }
    return "BOTH";
  }

  private async afterRoundResolved(state: MatchState, resolution: RoundResolution): Promise<void> {
    const { moveA, moveB, roundNumber } = resolution;
    const winnerSide = resolveRps(moveA, moveB);
    const winnerLabel: RoundResolvedPayload["winner"] =
      winnerSide === "DRAW" ? "draw" : winnerSide === "A" ? "a" : "b";

    const payloadA: RoundResolvedPayload = {
      matchId: state.matchId,
      roundNumber,
      yourMove: moveA,
      theirMove: moveB,
      winner: winnerLabel,
      scoreA: state.scoreA,
      scoreB: state.scoreB,
    };
    const payloadB: RoundResolvedPayload = {
      matchId: state.matchId,
      roundNumber,
      yourMove: moveB,
      theirMove: moveA,
      winner: winnerLabel,
      scoreA: state.scoreA,
      scoreB: state.scoreB,
    };

    await Promise.all([
      this.eventBus.broadcastToMatch(state.matchId, "roundResolved", payloadA, {
        recipientUserId: state.players[0].userId,
      }),
      this.eventBus.broadcastToMatch(state.matchId, "roundResolved", payloadB, {
        recipientUserId: state.players[1].userId,
      }),
    ]);

    if (state.status === "ENDED") {
      await this.finalizeMatch(state);
      return;
    }

    await this.schedulePhaseTimeout(
      state.matchId,
      state.currentRound,
      this.timeoutStateForStatus(state.status),
      state.roundDeadline,
    );
    await this.matchSessionService.broadcastRoundStart(state);
  }

  private timeoutStateForStatus(_status: MatchState["status"]): MatchTimeoutExpectedState {
    return "WAITING_PLAYS";
  }

  private async finalizeMatch(state: MatchState): Promise<void> {
    await this.clearTimer(state.matchId);
    this.metrics.recordMatchPlayed(this.resolveMatchOutcome(state));
    await this.matchDisconnectScheduler.cancelForfeitForPlayers(
      state.players.map((player) => player.userId),
    );

    const payload = {
      matchId: state.matchId,
      winner: state.winnerId ?? null,
      finalScore: { a: state.scoreA, b: state.scoreB },
      eloDelta: { a: 0, b: 0 },
      reason: state.endReason,
    };

    await Promise.all([
      this.eventBus.broadcastToMatch(state.matchId, "matchEnded", payload, {
        recipientUserId: state.players[0].userId,
      }),
      this.eventBus.broadcastToMatch(state.matchId, "matchEnded", payload, {
        recipientUserId: state.players[1].userId,
      }),
    ]);

    await this.matchSessionService.cleanupUserMappings(state);
    await this.matchEndedPublisher.publishMatchEnded(state);
  }

  private resolveMatchOutcome(state: MatchState): "win" | "draw" | "forfeit" {
    if (state.endReason === "FORFEIT_TIMEOUT" || state.endReason === "DISCONNECT_FORFEIT") {
      return "forfeit";
    }

    return state.winnerId ? "win" : "draw";
  }

  private async schedulePhaseTimeout(
    matchId: string,
    roundNumber: number,
    expectedState: MatchTimeoutExpectedState,
    deadlineIso: string,
  ): Promise<void> {
    const delayMs = Math.max(0, new Date(deadlineIso).getTime() - Date.now());
    try {
      await this.matchTimeoutScheduler.scheduleTimeout(
        matchId,
        roundNumber,
        expectedState,
        delayMs,
      );
    } catch (error) {
      this.logger.warn(
        { matchId, roundNumber, expectedState, error },
        "failed to schedule timeout",
      );
    }
  }

  private async clearTimer(matchId: string): Promise<void> {
    try {
      await this.matchTimeoutScheduler.cancelTimeout(matchId);
    } catch (error) {
      this.logger.warn({ matchId, error }, "failed to cancel round timeout");
    }
  }
}
