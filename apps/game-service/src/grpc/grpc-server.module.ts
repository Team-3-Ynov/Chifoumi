import { Module } from "@nestjs/common";
import { DirectedMatchModule } from "../directed-match/directed-match.module.js";
import { TournamentsGrpcController } from "./tournaments-grpc.controller.js";

@Module({
  imports: [DirectedMatchModule],
  controllers: [TournamentsGrpcController],
})
export class GrpcServerModule {}
