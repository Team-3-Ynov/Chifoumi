import { SubscribeMessage, WebSocketGateway } from "@nestjs/websockets";
import type { Socket } from "socket.io";
import { MatchPlayService, PlayValidationError } from "./match-play.service.js";

type PlayPayload = {
  matchId: string;
  roundNumber: number;
  move: string;
};

@WebSocketGateway({ namespace: "/game" })
export class MatchGateway {
  constructor(private readonly matchPlayService: MatchPlayService) {}

  @SubscribeMessage("play")
  async handlePlay(client: Socket, payload: PlayPayload): Promise<void> {
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
