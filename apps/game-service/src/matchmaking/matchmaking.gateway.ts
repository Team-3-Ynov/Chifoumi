import { Inject } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from "@nestjs/websockets";
import type { Socket } from "socket.io";
import { resolveCorsOrigins } from "../cors.js";
import { MatchPlayService, PlayValidationError } from "../match/match-play.service.js";
import { MatchmakingService } from "./matchmaking.service.js";

type PlayPayload = {
  matchId: string;
  roundNumber: number;
  move: string;
};

@WebSocketGateway({
  namespace: "/game",
  cors: {
    origin: resolveCorsOrigins(),
  },
})
export class MatchmakingGateway {
  constructor(
    @Inject(MatchmakingService) private readonly matchmakingService: MatchmakingService,
    @Inject(MatchPlayService) private readonly matchPlayService: MatchPlayService,
  ) {}

  @SubscribeMessage("joinQueue")
  async handleJoinQueue(@ConnectedSocket() client: Socket): Promise<void> {
    const userId = client.data.userId as string;
    const displayName = client.data.displayName as string;

    const result = await this.matchmakingService.joinQueue(userId, displayName);
    if (!result.ok) {
      client.emit("error", { code: result.code, message: result.code });
      return;
    }

    client.emit("queueJoined", {
      queuedAt: new Date(result.queuedAt).toISOString(),
      currentRating: result.currentRating,
    });
  }

  @SubscribeMessage("leaveQueue")
  async handleLeaveQueue(@ConnectedSocket() client: Socket): Promise<void> {
    const userId = client.data.userId as string;
    await this.matchmakingService.leaveQueue(userId);
    client.emit("queueLeft", {});
  }

  @SubscribeMessage("play")
  async handlePlay(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: PlayPayload,
  ): Promise<void> {
    const userId = client.data.userId as string | undefined;
    if (!userId) {
      return;
    }

    try {
      await this.matchPlayService.submitPlay({
        userId,
        matchId: payload.matchId,
        roundNumber: payload.roundNumber,
        move: payload.move,
      });
    } catch (error) {
      if (error instanceof PlayValidationError) {
        client.emit("error", { code: error.code, message: error.code });
      }
    }
  }
}
