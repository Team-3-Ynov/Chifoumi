import type {
  GameSocketClient,
  GameSocketEvent,
  GameSocketEventMap,
  GameSocketHandler,
} from "../../hooks/gameSocketTypes.js";

type HandlerMap = {
  [E in GameSocketEvent]?: Set<GameSocketHandler<E>>;
};

export class MockGameSocket implements GameSocketClient {
  readonly handlers: HandlerMap = {};
  connected = false;
  disconnected = false;

  connect(): void {
    this.connected = true;
  }

  disconnect(): void {
    this.disconnected = true;
    this.connected = false;
  }

  on<E extends GameSocketEvent>(event: E, handler: GameSocketHandler<E>): void {
    const handlers = this.handlers[event] ?? new Set<GameSocketHandler<E>>();
    handlers.add(handler);
    this.handlers[event] = handlers as HandlerMap[E];
  }

  off<E extends GameSocketEvent>(event: E, handler: GameSocketHandler<E>): void {
    this.handlers[event]?.delete(handler);
  }

  emit<E extends GameSocketEvent>(event: E, payload: GameSocketEventMap[E]): void {
    for (const handler of this.handlers[event] ?? []) {
      handler(payload);
    }
  }
}

export function createMockGameSocketFactory() {
  const sockets: MockGameSocket[] = [];

  const factory = () => {
    const socket = new MockGameSocket();
    sockets.push(socket);
    return socket;
  };

  return { factory, sockets };
}
