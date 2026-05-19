import { Module } from "@nestjs/common";
import { RunnerService } from "./runner.service.js";

@Module({
  providers: [RunnerService],
})
export class AppModule {}
