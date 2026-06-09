import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import { MatchEventBus } from "../match-session/match-event-bus.js";
import { MatchSessionService } from "../match-session/match-session.service.js";
import { type MatchState, type Move, playerIndex } from "../match-session/match-session.types.js";
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
  timeout: NodeJS.Timeout;
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

    const move = input.move as Move;
    let resolution: RoundResolution | null = null;

    const nextState = await this.matchSessionService.mutateState(input.matchId, (state) => {
      const index = playerIndex(state, input.userId);
      if (index === null) {
        throw new PlayValidationError("NOT_IN_MATCH");
      }

      if (state.status !== "WAITING_PLAYS" || input.roundNumber !== state.currentRound) {
        throw new PlayValidationError("WRONG_ROUND");
      }

      const slot = index === 0 ? "a" : "b";
      if (state.roundPlays[slot] !== null) {
        throw new PlayValidationError("ALREADY_PLAYED");
      }

      const roundPlays = { ...state.roundPlays, [slot]: move };
      const updated: MatchState = { ...state, roundPlays };

      if (roundPlays.a === null || roundPlays.b === null) {
        return updated;
      }

      resolution = {
        moveA: roundPlays.a,
        moveB: roundPlays.b,
        roundNumber: state.currentRound,
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
      return;
    }

    await this.afterRoundResolved(nextState, resolution);
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
    const winnerLabel = winnerSide === "DRAW" ? "draw" : winnerSide === "A" ? "a" : "b";

    await Promise.all([
      this.eventBus.broadcastToMatch(
        state.matchId,
        "roundResolved",
        {
          matchId: state.matchId,
          roundNumber,
          yourMove: moveA,
          theirMove: moveB,
          winner: winnerLabel,
          scoreA: state.scoreA,
          scoreB: state.scoreB,
        },
        { recipientUserId: state.players[0].userId },
      ),
      this.eventBus.broadcastToMatch(
        state.matchId,
        "roundResolved",
        {
          matchId: state.matchId,
          roundNumber,
          yourMove: moveB,
          theirMove: moveA,
          winner: winnerLabel,
          scoreA: state.scoreA,
          scoreB: state.scoreB,
        },
        { recipientUserId: state.players[1].userId },
      ),
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

    await Promise.all([
      this.eventBus.broadcastToMatch(
        state.matchId,
        "matchEnded",
        {
          matchId: state.matchId,
          winner: state.winnerId ?? null,
          finalScore: { a: state.scoreA, b: state.scoreB },
          eloDelta: { a: 0, b: 0 },
          reason: state.endReason,
        },
        { recipientUserId: state.players[0].userId },
      ),
      this.eventBus.broadcastToMatch(
        state.matchId,
        "matchEnded",
        {
          matchId: state.matchId,
          winner: state.winnerId ?? null,
          finalScore: { a: state.scoreA, b: state.scoreB },
          eloDelta: { a: 0, b: 0 },
          reason: state.endReason,
        },
        { recipientUserId: state.players[1].userId },
      ),
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
    timeout.unref();

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
