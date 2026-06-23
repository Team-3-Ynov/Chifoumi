/** @type {import("jest").Config} */
module.exports = {
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@chifoumi/db$": "<rootDir>/src/testing/chifoumi-db.mock.ts",
  },
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testRegex: ".*\\.spec\\.ts$",
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "\\.spec\\.ts$",
    "/dto/", // DTOs — validation-only, covered via controller/service tests
    "main\\.ts$", // NestJS bootstrap entrypoint
    "\\.module\\.ts$", // NestJS module wiring (declarative imports)
    "/scripts/", // CLI entrypoints (e.g. generate-openapi)
    "/testing/", // test doubles and mocks
    "/config/", // env/config loaders
    "/prisma/", // Prisma client wrapper (infrastructure)
    "/redis/", // Redis client wrapper (infrastructure)
    "/decorators/", // metadata decorators
    "swagger\\.ts$", // OpenAPI bootstrap
    "\\.controller\\.ts$", // HTTP adapters — covered by e2e tests
    "users\\.service\\.ts$", // user CRUD — covered by auth e2e flows
    "jwt\\.strategy\\.ts$", // Passport JWT wiring — covered by auth e2e flows
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
