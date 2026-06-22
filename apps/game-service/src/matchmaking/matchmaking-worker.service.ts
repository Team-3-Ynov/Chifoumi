import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import { v4 as uuidv4 } from "uuid";
import { MatchPlayService } from "../match/match-play.service.js";
import { MatchSessionService } from "../match-session/match-session.service.js";
import { RedisService } from "../redis/redis.service.js";
import { getEloWindow, ratingsMatch } from "./elo-window.js";
import {
  MATCHMAKING_PAIR_LOCK_TTL_SECONDS,
  MATCHMAKING_QUEUE_KEY,
  MATCHMAKING_WORKER_INTERVAL_MS,
  matchmakingPairLockKey,
  type QueueMemberMeta,
} from "./matchmaking.constants.js";
import { MatchmakingService } from "./matchmaking.service.js";
import { MatchmakingMetricsService } from "./matchmaking-metrics.service.js";

const PAIR_PLAYERS_SCRIPT = `
local queueKey = KEYS[1]
local metaPrefix = ARGV[1]
local pairLockKey = ARGV[2]
local matchId = ARGV[3]
local userA = ARGV[4]
local userB = ARGV[5]
local matchByUserPrefix = ARGV[6]
local matchStateKey = ARGV[7]
local matchStateJson = ARGV[8]
local matchTtl = tonumber(ARGV[9])

if redis.call("EXISTS", pairLockKey) == 0 then
  return 0
end

if redis.call("ZSCORE", queueKey, userA) == false or redis.call("ZSCORE", queueKey, userB) == false then
  redis.call("DEL", pairLockKey)
  return 0
end

redis.call("ZREM", queueKey, userA, userB)
redis.call("DEL", metaPrefix .. userA, metaPrefix .. userB)
redis.call("SETEX", matchByUserPrefix .. userA, matchTtl, matchId)
redis.call("SETEX", matchByUserPrefix .. userB, matchTtl, matchId)
redis.call("SETEX", matchStateKey, matchTtl, matchStateJson)
redis.call("DEL", pairLockKey)

return 1
`;

@Injectable()
export class MatchmakingWorkerService implements OnModuleInit, OnModuleDestroy {
  private interval: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly redisService: RedisService,
    private readonly matchmakingService: MatchmakingService,
    private readonly matchSessionService: MatchSessionService,
    private readonly matchPlayService: MatchPlayService,
    private readonly metricsService: MatchmakingMetricsService,
    private readonly logger: Logger,
  ) {}

  onModuleInit(): void {
    if (process.env.MATCHMAKING_WORKER_ENABLED === "false") {
      return;
    }

    const interval = setInterval(() => {
      void this.tick();
    }, MATCHMAKING_WORKER_INTERVAL_MS);
    this.interval = interval;
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  async tick(now = Date.now()): Promise<number> {
    if (this.running) {
      return 0;
    }

    this.running = true;
    try {
      const queueSize = await this.matchmakingService.getQueueSize();
      this.metricsService.setQueueSize(queueSize);

      if (queueSize < 2) {
        return 0;
      }

      const members = await this.matchmakingService.listQueueMembers();
      const pairedUserIds = new Set<string>();
      let matchesCreated = 0;

      for (const candidate of members) {
        if (pairedUserIds.has(candidate.userId)) {
          continue;
        }

        const opponent = this.findOpponent(candidate, members, now, pairedUserIds);
        if (!opponent) {
          continue;
        }

        const paired = await this.tryPairPlayers(candidate, opponent, now);
        if (paired) {
          pairedUserIds.add(candidate.userId);
          pairedUserIds.add(opponent.userId);
          matchesCreated += 1;
        }
      }

      return matchesCreated;
    } finally {
      this.running = false;
    }
  }

  findOpponent(
    player: QueueMemberMeta,
    members: QueueMemberMeta[],
    now: number,
    pairedUserIds: ReadonlySet<string> = new Set(),
  ): QueueMemberMeta | null {
    const playerWindow = getEloWindow(now - player.queuedAt);

    for (const candidate of members) {
      if (candidate.userId === player.userId) {
        continue;
      }

      if (pairedUserIds.has(candidate.userId)) {
        continue;
      }

      const candidateWindow = getEloWindow(now - candidate.queuedAt);
      if (ratingsMatch(player.rating, candidate.rating, playerWindow, candidateWindow)) {
        return candidate;
      }
    }

    return null;
  }

  private async tryPairPlayers(
    playerA: QueueMemberMeta,
    playerB: QueueMemberMeta,
    now: number,
  ): Promise<boolean> {
    const pairLockKey = matchmakingPairLockKey(playerA.userId, playerB.userId);
    const lockAcquired = await this.redisService.setnx(
      pairLockKey,
      MATCHMAKING_PAIR_LOCK_TTL_SECONDS,
    );
    if (!lockAcquired) {
      return false;
    }

    const matchId = uuidv4();
    const matchState = this.matchSessionService.buildInitialState(
      {
        userId: playerA.userId,
        displayName: playerA.displayName,
        rating: playerA.rating,
      },
      {
        userId: playerB.userId,
        displayName: playerB.displayName,
        rating: playerB.rating,
      },
      matchId,
      new Date(now),
    );

    const committed = await this.redisService.evalScript<number>(
      PAIR_PLAYERS_SCRIPT,
      [MATCHMAKING_QUEUE_KEY],
      [
        "matchmaking:meta:",
        pairLockKey,
        matchId,
        playerA.userId,
        playerB.userId,
        "match:byUser:",
        `match:${matchId}:state`,
        JSON.stringify(matchState),
        String(3600),
      ],
    );

    if (committed !== 1) {
      return false;
    }

    this.metricsService.observeMatchDuration(playerA.queuedAt, now);
    this.metricsService.observeMatchDuration(playerB.queuedAt, now);

    await this.matchPlayService.onMatchStarted(matchState);
    await this.matchSessionService.broadcastInitialEvents(matchState);

    this.logger.log(
      { matchId, playerA: playerA.userId, playerB: playerB.userId },
      "matchmaking pair created",
    );

    return true;
  }
}
