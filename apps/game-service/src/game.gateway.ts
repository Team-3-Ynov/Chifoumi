import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  WebSocketGateway,
} from "@nestjs/websockets";
import type { Socket } from "socket.io";
import { resolveCorsOrigins } from "./cors.js";

@WebSocketGateway({
  namespace: "/game",
  cors: {
    origin: resolveCorsOrigins(),
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  handleConnection(client: Socket) {
    console.log(`[game-service] socket connected ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[game-service] socket disconnected ${client.id}`);
  }
}
