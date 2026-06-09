import { Injectable, type OnModuleDestroy } from "@nestjs/common";
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
import { isValidMove, resolveRound as resolveRps } from "../rps/resolve.js";
import { MatchEndedPublisher } from "./match-ended-publisher.service.js";

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

type ActiveTimer = {
  timeout: ReturnType<typeof setTimeout>;
  roundNumber: number;
};

type RoundResolution = {
  moveA: Move;
  moveB: Move;
  roundNumber: number;
};

@Injectable()
export class MatchPlayService implements OnModuleDestroy {
  private readonly timers = new Map<string, ActiveTimer>();

  constructor(
    private readonly matchSessionService: MatchSessionService,
    private readonly eventBus: MatchEventBus,
    private readonly matchEndedPublisher: MatchEndedPublisher,
    private readonly logger: Logger,
  ) {}

  onModuleDestroy(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer.timeout);
    }
    this.timers.clear();
  }

  async onMatchStarted(state: MatchState): Promise<void> {
    this.scheduleRoundTimeout(state.matchId, state.currentRound, state.roundDeadline);
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
      return transitionMatchState(resolving, {
        type: "ROUND_RESOLVED",
        winner,
        now: new Date(),
      });
    });

    if (!resolution) {
      return null;
    }

    return { state: nextState, resolution };
  }

  async handleRoundTimeout(matchId: string, roundNumber: number): Promise<void> {
    const nextState = await this.matchSessionService.mutateState(matchId, (state) => {
      if (state.status !== "WAITING_PLAYS" || state.currentRound !== roundNumber) {
        return state;
      }

      const silentPlayer =
        state.roundPlays.a === null && state.roundPlays.b !== null
          ? "A"
          : state.roundPlays.b === null && state.roundPlays.a !== null
            ? "B"
            : "A";

      return transitionMatchState(state, {
        type: "TIMEOUT",
        silentPlayer,
        now: new Date(),
      });
    });

    if (nextState.status === "ENDED") {
      await this.finalizeMatch(nextState);
    }
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

    await this.matchSessionService.broadcastRoundStart(state);
    this.scheduleRoundTimeout(state.matchId, state.currentRound, state.roundDeadline);
  }

  private async finalizeMatch(state: MatchState): Promise<void> {
    this.clearTimer(state.matchId);

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

  private scheduleRoundTimeout(matchId: string, roundNumber: number, deadlineIso: string): void {
    this.clearTimer(matchId);

    const delayMs = Math.max(0, new Date(deadlineIso).getTime() - Date.now());
    const timeout = setTimeout(() => {
      void this.handleRoundTimeout(matchId, roundNumber).catch((error) => {
        this.logger.warn({ matchId, roundNumber, error }, "round timeout handling failed");
      });
    }, delayMs);

    this.timers.set(matchId, { timeout, roundNumber });
  }

  private clearTimer(matchId: string): void {
    const active = this.timers.get(matchId);
    if (active) {
      clearTimeout(active.timeout);
      this.timers.delete(matchId);
    }
  }
}
