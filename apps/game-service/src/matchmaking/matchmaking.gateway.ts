import { ConnectedSocket, SubscribeMessage, WebSocketGateway } from "@nestjs/websockets";
import type { Socket } from "socket.io";
import { resolveCorsOrigins } from "../cors.js";
import { MatchmakingService } from "./matchmaking.service.js";

@WebSocketGateway({
  namespace: "/game",
  cors: {
    origin: resolveCorsOrigins(),
  },
})
export class MatchmakingGateway {
  constructor(private readonly matchmakingService: MatchmakingService) {}

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
}
