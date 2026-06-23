/** @type {import("jest").Config} */
module.exports = {
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testRegex: ".*\\.spec\\.ts$",
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.spec.ts",
    "!src/cors.ts",
    "!src/**/dto/**",
    "!src/**/*.types.ts",
    "!src/main.ts",
    "!src/**/*.module.ts",
    "!src/config/**",
    "!src/redis/**",
    "!src/decorators/**",
    "!src/**/*.controller.ts",
    "!src/**/*.gateway.ts",
    "!src/testing/**",
    "!src/match/**/*worker.service.ts",
    "!src/match/match-ended-publisher.service.ts",
    "!src/match/match-events-relay.service.ts",
    "!src/matchmaking/matchmaking-events.service.ts",
  ],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "\\.spec\\.ts$",
    "/dto/", // DTOs — validation-only
    "\\.types\\.ts$", // shared WS/event type barrels
    "main\\.ts$", // NestJS bootstrap entrypoint
    "\\.module\\.ts$", // NestJS module wiring
    "/config/", // env/config loaders
    "/redis/", // Redis client wrapper (infrastructure)
    "/decorators/", // metadata decorators
    "\\.controller\\.ts$", // HTTP/WS adapters — covered by e2e tests
    "metrics\\.controller\\.ts$", // Prometheus scrape wiring
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
    },
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "tsconfig.spec.json",
      },
    ],
  },
};
