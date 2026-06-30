import { Module } from "@nestjs/common";
import { UserService } from "./users.service.js";
import { UsersGrpcController } from "./users-grpc.controller.js";

@Module({
  controllers: [UsersGrpcController],
  providers: [UserService],
  exports: [UserService],
})
export class UsersModule {}
