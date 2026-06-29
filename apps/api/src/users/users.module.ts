import { Module } from "@nestjs/common";
import { UserServiceModule } from "../user-service/user-service.module.js";
import { UsersController } from "./users.controller.js";

@Module({
  imports: [UserServiceModule],
  controllers: [UsersController],
})
export class UsersModule {}
