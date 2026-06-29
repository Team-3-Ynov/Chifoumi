/** @type {import("jest").Config} */
module.exports = {
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@chifoumi/db$": "@prisma/client",
  },
  testEnvironment: "node",
  maxWorkers: 1,
  rootDir: ".",
  testRegex: "test/.*\\.e2e-spec\\.ts$",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "tsconfig.e2e.json",
      },
    ],
  },
  transformIgnorePatterns: ["node_modules/(?!(@prisma/client|\\.prisma/client)/)"],
  // BullMQ + ioredis can leave reconnect timers open after failed local runs.
  forceExit: true,
};
