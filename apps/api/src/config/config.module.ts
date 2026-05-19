import { Global, Module } from "@nestjs/common";
import { JWT_CONFIG, loadJwtConfig } from "./jwt.config.js";

@Global()
@Module({
  providers: [
    {
      provide: JWT_CONFIG,
      useFactory: () => loadJwtConfig(),
    },
  ],
  exports: [JWT_CONFIG],
})
export class AppConfigModule {}
