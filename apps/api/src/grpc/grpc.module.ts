import { Module } from "@nestjs/common";
import { UserServiceModule } from "../user-service/user-service.module.js";
import { UsersGrpcController } from "./users-grpc.controller.js";

@Module({
  imports: [UserServiceModule],
  controllers: [UsersGrpcController],
})
export class GrpcModule {}
