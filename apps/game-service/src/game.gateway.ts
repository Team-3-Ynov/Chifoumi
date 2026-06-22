import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Logger } from "nestjs-pino";
import type { Server, Socket } from "socket.io";
import { WS_AUTH_INVALID_TOKEN_CODE, WsAuthError } from "./auth/ws-auth.error.js";
import { WsAuthService } from "./auth/ws-auth.service.js";
import { resolveCorsOrigins } from "./cors.js";
import { scrubTokenFromUrl } from "./logging/scrub-token.js";
import { MatchEventsRelayService } from "./match/match-events-relay.service.js";
import { MatchReconnectService } from "./match/match-reconnect.service.js";
import { MatchmakingEventsService } from "./matchmaking/matchmaking-events.service.js";
import { RedisService } from "./redis/redis.service.js";

function extractToken(socket: Socket): string | undefined {
  const queryToken = socket.handshake.query.token;
  if (typeof queryToken === "string") {
    return queryToken;
  }
  if (Array.isArray(queryToken) && queryToken[0]) {
    return queryToken[0];
  }
  return undefined;
}

@WebSocketGateway({
  namespace: "/game",
  cors: {
    origin: resolveCorsOrigins(),
  },
})
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly wsAuthService: WsAuthService,
    private readonly redisService: RedisService,
    private readonly matchmakingEventsService: MatchmakingEventsService,
    private readonly matchEventsRelayService: MatchEventsRelayService,
    private readonly matchReconnectService: MatchReconnectService,
    private readonly logger: Logger,
  ) {}

  afterInit(server: Server): void {
    this.matchmakingEventsService.setServer(server);
    this.matchEventsRelayService.setServer(server);

    server.use(async (socket, next) => {
      try {
        const auth = await this.wsAuthService.verifyToken(extractToken(socket));
        socket.data.userId = auth.userId;
        socket.data.displayName = auth.displayName;
        socket.data.jti = auth.jti;
        next();
      } catch (error) {
        if (error instanceof WsAuthError) {
          const err = new Error(error.message) as Error & { data: { code: number } };
          err.data = { code: error.code };
          return next(err);
        }

        const err = new Error("INVALID_TOKEN") as Error & { data: { code: number } };
        err.data = { code: WS_AUTH_INVALID_TOKEN_CODE };
        next(err);
      }
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    const userId = client.data.userId as string;
    const displayName = client.data.displayName as string;

    await this.redisService.setUserSocket(userId, client.id);
    client.emit("connected", { userId, displayName });

    const resumed = await this.matchReconnectService.handleReconnect(userId);
    if (resumed) {
      client.emit("matchResumed", resumed);
    }

    const requestUrl = client.request.url ?? "";
    this.logger.log(
      { userId, socketId: client.id, url: scrubTokenFromUrl(requestUrl) },
      "game socket connected",
    );
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId = client.data.userId as string | undefined;
    if (userId) {
      try {
        await this.matchReconnectService.handleDisconnect(userId, client.id);
      } catch {
        // Redis may already be closed during app shutdown in e2e tests.
      }
    }
  }
}
