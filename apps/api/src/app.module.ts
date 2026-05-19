import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module.js";
import { AppConfigModule } from "./config/config.module.js";
import { HealthModule } from "./health/health.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { UsersModule } from "./users/users.module.js";

@Module({
  imports: [AppConfigModule, PrismaModule, HealthModule, UsersModule, AuthModule],
})
export class AppModule {}
