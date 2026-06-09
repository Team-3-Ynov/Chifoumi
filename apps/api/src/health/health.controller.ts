import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: "ok",
      service: "api",
      instance: process.env.INSTANCE_ID ?? "api",
      version: "1.0.0",
    };
  }
}
