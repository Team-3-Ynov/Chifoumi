import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: "ok",
      service: "game-service",
      instance: process.env.INSTANCE_ID ?? "game-service",
      version: "0.0.0",
    };
  }
}
