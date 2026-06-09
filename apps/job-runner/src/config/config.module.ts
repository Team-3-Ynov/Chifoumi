import { Global, Module } from "@nestjs/common";
import { JOB_RUNNER_CONFIG, loadEnv } from "./env.js";

@Global()
@Module({
  providers: [
    {
      provide: JOB_RUNNER_CONFIG,
      useFactory: () => loadEnv(),
    },
  ],
  exports: [JOB_RUNNER_CONFIG],
})
export class ConfigModule {}
