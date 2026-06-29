import { createConnection } from "node:net";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";

const DEFAULT_GRPC_PORT = 50054;

function isGrpcPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

@Controller("health")
export class HealthController {
  @Get()
  async getHealth(@Res({ passthrough: true }) res: { status(code: number): void }) {
    const grpcPort = Number(process.env.AUTH_SERVICE_GRPC_PORT ?? DEFAULT_GRPC_PORT);
    const grpcReady = await isGrpcPortListening(grpcPort);

    if (!grpcReady) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: grpcReady ? "ok" : "degraded",
      service: "auth-service",
      instance: process.env.INSTANCE_ID ?? "auth-service",
      version: "1.0.0",
      grpc: grpcReady ? "ok" : "unavailable",
    };
  }
}
